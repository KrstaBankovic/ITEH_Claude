export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

type Envelope<T> = { data: T; meta?: { page: number; pageSize: number; total: number } };
type ErrorEnvelope = { error: { code: string; message: string; details?: unknown } };

/** Calls the API and unwraps the `{ data }` envelope, throwing on `{ error }`. */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });

  if (res.status === 204) return undefined as T;

  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = (body as ErrorEnvelope | null)?.error;
    throw new ApiClientError(
      res.status,
      error?.code ?? "INTERNAL_ERROR",
      error?.message ?? "Request failed.",
      error?.details,
    );
  }
  return (body as Envelope<T>).data;
}

/** Same as `api`, but also returns the collection `meta`. */
export async function apiList<T>(path: string): Promise<Envelope<T>> {
  const res = await fetch(path);
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = (body as ErrorEnvelope | null)?.error;
    throw new ApiClientError(
      res.status,
      error?.code ?? "INTERNAL_ERROR",
      error?.message ?? "Request failed.",
      error?.details,
    );
  }
  return body as Envelope<T>;
}
