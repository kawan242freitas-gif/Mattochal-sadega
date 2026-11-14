import type { IncomingMessage, ServerResponse } from "node:http";

export type VercelRequest = IncomingMessage & {
  query: Record<string, string | string[] | undefined>;
  body?: unknown;
};

export type VercelResponse = ServerResponse & {
  status(code: number): VercelResponse;
  json(value: unknown): VercelResponse;
};
