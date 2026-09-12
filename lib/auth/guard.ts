import { SignJWT, jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { ApiError } from "@/lib/api/withApi";
import { ROLE_VALUES, type Role } from "@/lib/domain";

export const SESSION_COOKIE = "gt_session";
const SESSION_DAYS = 7;

export const ROLES = ROLE_VALUES;
export type { Role };

export type Session = { userId: number; email: string; role: Role };

function secret(): Uint8Array {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(value);
}

export async function signSession(session: Session): Promise<string> {
  return new SignJWT({ email: session.email, role: session.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(session.userId))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
}

/** Cookie attributes for the session token; `maxAge` of 0 clears it. */
export function sessionCookie(token: string, maxAge = SESSION_DAYS * 86_400) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/** Returns the caller's session, or null when the cookie is missing or invalid. */
export async function getSession(req: NextRequest): Promise<Session | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const role = payload.role as Role;
    if (!payload.sub || !ROLES.includes(role)) return null;
    return { userId: Number(payload.sub), email: String(payload.email), role };
  } catch {
    return null;
  }
}

export async function requireAuth(req: NextRequest): Promise<Session> {
  const session = await getSession(req);
  if (!session) throw new ApiError(401, "UNAUTHENTICATED", "Authentication required.");
  return session;
}

export async function requireRole(req: NextRequest, roles: readonly Role[]): Promise<Session> {
  const session = await requireAuth(req);
  if (!roles.includes(session.role)) {
    throw new ApiError(403, "FORBIDDEN", "Your role does not allow this action.");
  }
  return session;
}
