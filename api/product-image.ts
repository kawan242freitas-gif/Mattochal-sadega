import type { VercelRequest, VercelResponse } from "../lib/vercel-types";
import { hasAdminToken } from "../lib/admin-auth";

const MAX_IMAGE_BYTES = 1_800_000;

function safeFileName(value: unknown, mimeType: string) {
  const name = typeof value === "string" ? value.trim().split(/[\\/]/).pop() || "imagem" : "imagem";
  const stem = name.replace(/\.[^.]+$/, "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
  const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  return `${stem || "produto"}.${extension}`;
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }
  if (!process.env.ADMIN_API_TOKEN) return response.status(503).json({ error: "ADMIN_TOKEN_NOT_CONFIGURED" });
  if (!hasAdminToken(request)) return response.status(401).json({ error: "UNAUTHORIZED" });

  const body = request.body && typeof request.body === "object" ? request.body as Record<string, unknown> : {};
  const dataUrl = typeof body.dataUrl === "string" ? body.dataUrl : "";
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return response.status(400).json({ error: "INVALID_IMAGE" });

  const mimeType = match[1];
  const bytes = Buffer.from(match[2], "base64");
  const validJpeg = mimeType === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const validPng = mimeType === "image/png" && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const validWebp = mimeType === "image/webp" && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (bytes.length < 8 || bytes.length > MAX_IMAGE_BYTES || !(validJpeg || validPng || validWebp)) {
    return response.status(400).json({ error: "INVALID_IMAGE" });
  }

  const apiToken = (process.env.FIVEMANAGE_API_TOKEN_IMAGEM || process.env.FIVEMANAGE_API_TOKEN)?.trim();
  if (!apiToken) return response.status(503).json({ error: "FIVEMANAGE_NOT_CONFIGURED" });

  const fileName = safeFileName(body.fileName, mimeType);
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(bytes)], { type: mimeType }), fileName);
  form.append("filename", fileName);
  form.append("path", "produtos/matto-chales");
  form.append("metadata", JSON.stringify({ kind: "product", source: "matto-chales-admin" }));

  try {
    const uploadResponse = await fetch("https://api.fivemanage.com/api/v3/file", {
      method: "POST",
      headers: { Authorization: apiToken },
      body: form,
    });
    const result = await uploadResponse.json() as { data?: { id?: unknown; url?: unknown; originalUrl?: unknown } };
    const imageUrl = typeof result.data?.url === "string" ? result.data.url : result.data?.originalUrl;
    if (!uploadResponse.ok || typeof imageUrl !== "string" || !imageUrl.startsWith("https://")) {
      return response.status(502).json({ error: "FIVEMANAGE_UPLOAD_FAILED" });
    }
    return response.status(200).json({ imageUrl, ...(typeof result.data?.id === "string" ? { fileId: result.data.id } : {}) });
  } catch {
    return response.status(502).json({ error: "FIVEMANAGE_UPLOAD_FAILED" });
  }
}
