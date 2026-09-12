import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type Meta = { page: number; pageSize: number; total: number };

/** Success envelope: `{ data }`, plus `{ meta }` on collections. */
export function json(
  data: unknown,
  init?: { status?: number; meta?: Meta },
): NextResponse {
  const body = init?.meta ? { data, meta: init.meta } : { data };
  return NextResponse.json(body, { status: init?.status ?? 200 });
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

/**
 * Wraps a route handler so no handler needs a try/catch. An `ApiError` becomes the
 * JSON error envelope with its own status; anything else becomes a 500 that never
 * leaks a stack trace to the client.
 */
export function withApi<Args extends unknown[]>(
  handler: (req: NextRequest, ...args: Args) => Promise<NextResponse>,
) {
  return async (req: NextRequest, ...args: Args): Promise<NextResponse> => {
    try {
      return await handler(req, ...args);
    } catch (err) {
      if (err instanceof ApiError) {
        return NextResponse.json(
          {
            error: {
              code: err.code,
              message: err.message,
              ...(err.details !== undefined ? { details: err.details } : {}),
            },
          },
          { status: err.status },
        );
      }
      console.error(err);
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Unexpected server error." } },
        { status: 500 },
      );
    }
  };
}
