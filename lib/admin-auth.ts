import { timingSafeEqual } from "node:crypto";
import type { VercelRequest } from "./vercel-types";

export function hasAdminToken(request: VercelRequest) {
  const expectedToken = process.env.ADMIN_API_TOKEN;
  const providedToken = request.headers.authorization?.replace(/^Bearer\s+/i, "");

  if (!expectedToken || !providedToken) return false;

  const expected = Buffer.from(expectedToken);
  const provided = Buffer.from(providedToken);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}
