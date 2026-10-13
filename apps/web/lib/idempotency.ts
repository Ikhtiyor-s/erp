import { AxiosError, type AxiosInstance } from "axios";

export function newIdempotencyKey(): string {
  return crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function isRetryableNetworkError(e: unknown): boolean {
  return e instanceof AxiosError && (e.code === "ERR_NETWORK" || e.code === "ECONNABORTED");
}

// POS-6: one Idempotency-Key per logical user action. Network-level failures
// (ERR_NETWORK/ECONNABORTED) retry ONCE with the SAME key — the request may
// have already reached the server, so a fresh key would create a real
// duplicate instead of replaying the cached result.
export async function postIdempotent<T = any>(
  client: AxiosInstance,
  url: string,
  body: unknown,
  idempotencyKey: string,
): Promise<T> {
  const config = { headers: { "Idempotency-Key": idempotencyKey } };
  try {
    const { data } = await client.post<T>(url, body, config);
    return data;
  } catch (e) {
    if (!isRetryableNetworkError(e)) throw e;
    const { data } = await client.post<T>(url, body, config);
    return data;
  }
}
