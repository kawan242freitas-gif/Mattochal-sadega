import type { VercelRequest, VercelResponse } from "../lib/vercel-types";
import { hasAdminToken } from "../lib/admin-auth";

export default function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  if (!process.env.ADMIN_API_TOKEN) {
    return response.status(503).json({ error: "ADMIN_TOKEN_NOT_CONFIGURED" });
  }

  if (!hasAdminToken(request)) {
    return response.status(401).json({ error: "INVALID_ADMIN_TOKEN" });
  }

  return response.status(204).end();
}
