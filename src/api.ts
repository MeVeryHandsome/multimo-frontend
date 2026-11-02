// Backend responses are wrapped by GoFrame's MiddlewareHandlerResponse.
type Envelope<T> = { code: number; message: string; data: T };

export class ApiError extends Error {
  constructor(message: string, readonly code: number) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v1${path}`, init);
  const body = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!res.ok || !body || body.code !== 0) {
    throw new ApiError(body?.message ?? res.statusText, body?.code ?? res.status);
  }
  return body.data;
}

export type Health = {
  status: "ok" | "degraded";
  version: string;
  database: "up" | "down";
  models: { vlm: string; embedding: string; embeddingDim: number; decision: string };
  missing: string[];
  time: string;
};
