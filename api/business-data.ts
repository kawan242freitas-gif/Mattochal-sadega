import type { VercelRequest, VercelResponse } from "../lib/vercel-types";
import { hasAdminToken } from "../lib/admin-auth";
import { getMongoDatabase } from "../lib/mongodb";

const COLLECTIONS = {
  reservations: "reservations",
  movements: "financial_movements",
  payables: "payable_accounts",
} as const;

type DataKey = keyof typeof COLLECTIONS;
type DataRecord = Record<string, unknown> & { id: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function validRecord(key: DataKey, value: unknown): value is DataRecord {
  if (!isRecord(value) || typeof value.id !== "string" || !value.id.trim() || value.id.length > 100) return false;
  const stringFields: Record<DataKey, string[]> = {
    reservations: ["responsible", "chalet", "check_in", "check_out", "check_in_time", "check_out_time", "restrictions", "notes"],
    movements: ["kind", "description", "date", "payment_method", "category", "notes"],
    payables: ["description", "supplier", "due_date", "category", "installments", "notes"],
  };
  const maxLengths: Record<string, number> = { responsible: 160, chalet: 120, description: 240, notes: 4000, restrictions: 1000, attachments: 40 };
  if (!stringFields[key].every((field) => typeof value[field] === "string" && (value[field] as string).length <= (maxLengths[field] ?? 300))) return false;

  if (key === "reservations") {
    return typeof value.guests === "number" && Number.isInteger(value.guests) && value.guests > 0 && value.guests <= 100
      && ["pets", "breakfast", "decoration", "reserved"].every((field) => typeof value[field] === "boolean")
      && Array.isArray(value.attachments) && value.attachments.length <= 40
      && value.attachments.every((item) => typeof item === "string" && item.length <= 2048);
  }
  if (typeof value.amount_cents !== "number" || !Number.isSafeInteger(value.amount_cents) || value.amount_cents < 0 || value.amount_cents > 9_000_000_000_000) return false;
  return key === "movements" || typeof value.paid === "boolean";
}

async function upsert(database: Awaited<ReturnType<typeof getMongoDatabase>>, key: DataKey, value: unknown) {
  if (!validRecord(key, value)) throw new Error("INVALID_RECORD");
  await database.collection(COLLECTIONS[key]).updateOne(
    { id: value.id },
    { $set: { ...value, updatedAt: new Date() } },
    { upsert: true },
  );
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader("Cache-Control", "no-store");
  if (!["GET", "POST", "DELETE"].includes(request.method || "")) {
    response.setHeader("Allow", "GET, POST, DELETE");
    return response.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }
  if (!process.env.ADMIN_API_TOKEN) return response.status(503).json({ error: "ADMIN_TOKEN_NOT_CONFIGURED" });
  if (!hasAdminToken(request)) return response.status(401).json({ error: "UNAUTHORIZED" });

  try {
    const database = await getMongoDatabase();
    if (request.method === "GET") {
      const [reservations, movements, payables] = await Promise.all(
        (Object.keys(COLLECTIONS) as DataKey[]).map((key) => database.collection(COLLECTIONS[key]).find({}, { projection: { _id: 0, updatedAt: 0 } }).toArray()),
      );
      return response.status(200).json({ reservations, movements, payables });
    }

    const body = isRecord(request.body) ? request.body : {};
    const key = request.method === "DELETE" ? request.query.collection : body.collection;
    if (typeof key !== "string" || !Object.keys(COLLECTIONS).includes(key)) return response.status(400).json({ error: "INVALID_COLLECTION" });
    const dataKey = key as DataKey;

    if (request.method === "DELETE") {
      const id = typeof request.query.id === "string" ? request.query.id : "";
      if (!id || id.length > 100) return response.status(400).json({ error: "INVALID_RECORD_ID" });
      await database.collection(COLLECTIONS[dataKey]).deleteOne({ id });
      return response.status(204).end();
    }

    if (body.action === "sync") {
      if (!Array.isArray(body.records) || body.records.length > 5000 || !body.records.every((record) => validRecord(dataKey, record))) {
        return response.status(400).json({ error: "INVALID_RECORDS" });
      }
      await Promise.all(body.records.map((record) => upsert(database, dataKey, record)));
      return response.status(200).json({ saved: body.records.length });
    }
    if (body.action !== "upsert" || !validRecord(dataKey, body.record)) return response.status(400).json({ error: "INVALID_RECORD" });
    await upsert(database, dataKey, body.record);
    return response.status(200).json({ id: body.record.id });
  } catch (error) {
    if (error instanceof Error && error.message === "MONGODB_NOT_CONFIGURED") return response.status(503).json({ error: "MONGODB_NOT_CONFIGURED" });
    if (error instanceof Error && error.message === "INVALID_RECORD") return response.status(400).json({ error: "INVALID_RECORD" });
    console.error("Business data API failed", error);
    return response.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
  }
}
