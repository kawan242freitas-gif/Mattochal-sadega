import type { VercelRequest, VercelResponse } from "../lib/vercel-types";
import { ObjectId, type WithId } from "mongodb";
import { hasAdminToken } from "../lib/admin-auth";
import { getMongoDatabase } from "../lib/mongodb";

type ProductDocument = {
  name: string;
  label: string;
  price: string;
  description: string;
  tone: string;
  category: "adega" | "frigobar";
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
};

type ProductInput = Pick<ProductDocument, "name" | "label" | "price" | "description" | "tone" | "category" | "imageUrl">;

function toProduct(document: WithId<ProductDocument>) {
  return {
    id: document._id.toHexString(),
    name: document.name,
    label: document.label,
    price: document.price,
    description: document.description || "Produto selecionado pela Matto Chalés.",
    tone: document.tone,
    category: document.category === "frigobar" ? "frigobar" : "adega",
    ...(document.imageUrl ? { imageUrl: document.imageUrl } : {}),
  };
}

function parseProduct(body: unknown): ProductInput | null {
  if (!body || typeof body !== "object") return null;
  const value = body as Record<string, unknown>;
  if (typeof value.name !== "string" || !value.name.trim()) return null;

  const name = value.name.trim().slice(0, 120);
  const label = typeof value.label === "string" && value.label.trim()
    ? value.label.trim().slice(0, 80)
    : name.toUpperCase();
  const price = typeof value.price === "string" ? value.price.trim().slice(0, 40) : "";
  const tone = ["gold", "ivory", "olive"].includes(String(value.tone)) ? String(value.tone) : "ivory";
  const category = value.category === "frigobar" ? "frigobar" : "adega";
  const imageUrl = typeof value.imageUrl === "string" ? value.imageUrl.trim().slice(0, 2048) : "";
  if (imageUrl && !imageUrl.startsWith("https://")) return null;

  if (!price) return null;
  const description = typeof value.description === "string" && value.description.trim()
    ? value.description.trim().slice(0, 300)
    : "Produto selecionado pela Matto Chalés.";

  return { name, label, price, description, tone, category, ...(imageUrl ? { imageUrl } : {}) };
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader("Cache-Control", "no-store");

  if (!["GET", "POST", "PUT", "DELETE"].includes(request.method || "")) {
    response.setHeader("Allow", "GET, POST, PUT, DELETE");
    return response.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  if (request.method !== "GET") {
    if (!process.env.ADMIN_API_TOKEN) {
      return response.status(503).json({ error: "ADMIN_TOKEN_NOT_CONFIGURED" });
    }
    if (!hasAdminToken(request)) {
      return response.status(401).json({ error: "UNAUTHORIZED" });
    }
  }

  try {
    const database = await getMongoDatabase();
    const collection = database.collection<ProductDocument>("products");

    if (request.method === "GET") {
      const products = await collection.find().sort({ updatedAt: -1, name: 1 }).toArray();
      return response.status(200).json(products.map(toProduct));
    }

    if (request.method === "POST") {
      const product = parseProduct(request.body);
      if (!product) return response.status(400).json({ error: "INVALID_PRODUCT" });

      const now = new Date();
      const result = await collection.insertOne({ ...product, createdAt: now, updatedAt: now });
      return response.status(201).json({ id: result.insertedId.toHexString(), ...product });
    }

    const id = typeof request.query.id === "string" ? request.query.id : "";
    if (!ObjectId.isValid(id)) return response.status(400).json({ error: "INVALID_PRODUCT_ID" });
    const objectId = new ObjectId(id);

    if (request.method === "PUT") {
      const product = parseProduct(request.body);
      if (!product) return response.status(400).json({ error: "INVALID_PRODUCT" });

      const result = await collection.updateOne({ _id: objectId }, { $set: { ...product, updatedAt: new Date() }, $unset: { featured: "" } });
      if (result.matchedCount === 0) return response.status(404).json({ error: "PRODUCT_NOT_FOUND" });
      const updated = await collection.findOne({ _id: objectId });
      return response.status(200).json(updated ? toProduct(updated) : null);
    }

    const result = await collection.deleteOne({ _id: objectId });
    if (result.deletedCount === 0) return response.status(404).json({ error: "PRODUCT_NOT_FOUND" });
    return response.status(204).end();
  } catch (error) {
    if (error instanceof Error && error.message === "MONGODB_NOT_CONFIGURED") {
      return response.status(503).json({ error: "MONGODB_NOT_CONFIGURED" });
    }
    console.error("Products API failed", error);
    return response.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
  }
}
