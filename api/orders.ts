import { createHash, randomBytes } from "node:crypto";
import type { VercelRequest, VercelResponse } from "../lib/vercel-types";
import { ObjectId, type WithId } from "mongodb";
import { getMongoDatabase } from "../lib/mongodb";

type ProductDocument = {
  name: string;
  label: string;
  price: string;
  description?: string;
  tone: string;
  category?: "adega" | "frigobar";
  imageUrl?: string;
};

type OrderItem = {
  productId: string;
  name: string;
  label: string;
  quantity: number;
  unitPrice: number;
  tone: string;
  imageUrl?: string;
};

type OrderDocument = {
  tokenHash: string;
  orderNumber: string;
  customerName: string;
  chaletNumber: string;
  items: OrderItem[];
  subtotal: number;
  notes: string;
  status: "awaiting_proof" | "proof_submitted" | "confirmed";
  proof?: { name: string; dataUrl: string; uploadedAt: Date };
  createdAt: Date;
  updatedAt: Date;
};

function parsePrice(value: string) {
  if (!value || value.toLocaleLowerCase().includes("consulte")) return null;
  const normalized = value.replace(/[^\d,.-]/g, "");
  const decimal = normalized.includes(",")
    ? normalized.replace(/\./g, "").replace(",", ".")
    : normalized;
  const parsed = Number(decimal);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function publicOrder(document: WithId<OrderDocument>) {
  return {
    id: document.orderNumber,
    customerName: document.customerName,
    chaletNumber: document.chaletNumber,
    items: document.items,
    subtotal: document.subtotal,
    notes: document.notes,
    status: document.status,
    ...(document.proof ? { proof: { name: document.proof.name, dataUrl: document.proof.dataUrl, uploadedAt: document.proof.uploadedAt } } : {}),
    createdAt: document.createdAt,
  };
}

function isJpegDataUrl(value: unknown) {
  if (typeof value !== "string") return false;
  const match = value.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return false;
  const image = Buffer.from(match[1], "base64");
  return image.length > 8 && image.length <= 1_800_000 && image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff;
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader("Cache-Control", "no-store, private");
  response.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  response.setHeader("Referrer-Policy", "no-referrer");

  if (!["GET", "POST"].includes(request.method || "")) {
    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  try {
    const database = await getMongoDatabase();
    const orders = database.collection<OrderDocument>("orders");
    await orders.createIndex({ tokenHash: 1 }, { unique: true });

    if (request.method === "GET") {
      const token = typeof request.query.token === "string" ? request.query.token : "";
      if (!/^[a-f0-9]{64}$/.test(token)) return response.status(400).json({ error: "INVALID_ORDER_LINK" });
      const document = await orders.findOne({ tokenHash: createHash("sha256").update(token).digest("hex") });
      if (!document) return response.status(404).json({ error: "ORDER_NOT_FOUND" });
      return response.status(200).json(publicOrder(document));
    }

    const body = request.body && typeof request.body === "object" ? request.body as Record<string, unknown> : {};
    if (body.action === "proof") {
      const token = typeof body.token === "string" ? body.token : "";
      if (!/^[a-f0-9]{64}$/.test(token) || !isJpegDataUrl(body.dataUrl)) {
        return response.status(400).json({ error: "INVALID_PROOF_IMAGE" });
      }
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const order = await orders.findOne({ tokenHash });
      if (!order) return response.status(404).json({ error: "ORDER_NOT_FOUND" });
      if (order.status === "confirmed") return response.status(409).json({ error: "ORDER_ALREADY_CONFIRMED" });
      const name = typeof body.fileName === "string" ? body.fileName.trim().slice(0, 120) : "comprovante.jpg";
      await orders.updateOne({ _id: order._id }, {
        $set: {
          proof: { name: name || "comprovante.jpg", dataUrl: body.dataUrl as string, uploadedAt: new Date() },
          status: "proof_submitted",
          updatedAt: new Date(),
        },
      });
      const updated = await orders.findOne({ _id: order._id });
      return response.status(200).json(updated ? publicOrder(updated) : null);
    }

    const customerName = typeof body.customerName === "string" ? body.customerName.trim().slice(0, 100) : "";
    const chaletNumber = typeof body.chaletNumber === "string" ? body.chaletNumber.trim().slice(0, 40) : "";
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) : "";
    if (!customerName || !chaletNumber || !Array.isArray(body.items) || body.items.length === 0 || body.items.length > 50) {
      return response.status(400).json({ error: "INVALID_ORDER" });
    }

    const itemsRequested: { productId: string; quantity: number }[] = [];
    for (const item of body.items) {
      if (!item || typeof item !== "object") return response.status(400).json({ error: "INVALID_ORDER_ITEMS" });
      const value = item as Record<string, unknown>;
      if (typeof value.productId !== "string" || !ObjectId.isValid(value.productId) || !Number.isInteger(value.quantity) || Number(value.quantity) < 1 || Number(value.quantity) > 99) {
        return response.status(400).json({ error: "INVALID_ORDER_ITEMS" });
      }
      itemsRequested.push({ productId: value.productId, quantity: Number(value.quantity) });
    }

    const productCollection = database.collection<ProductDocument>("products");
    const productIds = itemsRequested.map((item) => new ObjectId(item.productId));
    const products = await productCollection.find({ _id: { $in: productIds } }).toArray();
    const productMap = new Map(products.map((product) => [product._id.toHexString(), product]));
    const items: OrderItem[] = [];
    for (const requested of itemsRequested) {
      const product = productMap.get(requested.productId);
      if (!product) return response.status(409).json({ error: "PRODUCT_NO_LONGER_AVAILABLE" });
      const unitPrice = parsePrice(product.price);
      if (unitPrice === null) return response.status(409).json({ error: "PRODUCT_PRICE_UNAVAILABLE", product: product.name });
      items.push({
        productId: requested.productId,
        name: product.name,
        label: product.label,
        quantity: requested.quantity,
        unitPrice,
        tone: product.tone,
        ...(product.imageUrl ? { imageUrl: product.imageUrl } : {}),
      });
    }

    const token = randomBytes(32).toString("hex");
    const orderNumber = `MC-${new Date().getFullYear()}-${randomBytes(5).toString("hex").toUpperCase()}`;
    const now = new Date();
    const order: OrderDocument = {
      tokenHash: createHash("sha256").update(token).digest("hex"),
      orderNumber,
      customerName,
      chaletNumber,
      items,
      subtotal: items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
      notes,
      status: "awaiting_proof",
      createdAt: now,
      updatedAt: now,
    };
    const inserted = await orders.insertOne(order);
    const saved = await orders.findOne({ _id: inserted.insertedId });
    return response.status(201).json({ token, order: saved ? publicOrder(saved) : null });
  } catch (error) {
    if (error instanceof Error && error.message === "MONGODB_NOT_CONFIGURED") {
      return response.status(503).json({ error: "MONGODB_NOT_CONFIGURED" });
    }
    console.error("Orders API failed", error);
    return response.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
  }
}
