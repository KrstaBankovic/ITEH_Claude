import bcrypt from "bcryptjs";
import { z } from "zod";
import { ApiError } from "@/lib/api/withApi";
import { signSession, type Role } from "@/lib/auth/guard";
import { sql } from "@/lib/db";

const BCRYPT_COST = 10;

export const registerSchema = z.object({
  email: z.email().max(255),
  password: z.string().min(8, "Password must be at least 8 characters.").max(72),
  fullName: z.string().trim().min(2).max(120),
});

export const loginSchema = z.object({
  email: z.email().max(255),
  password: z.string().min(1).max(72),
});

export type PublicUser = {
  id: number;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
};

type UserRow = {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  password_hash: string;
};

const toPublicUser = (row: UserRow): PublicUser => ({
  id: row.id,
  email: row.email,
  fullName: row.full_name,
  role: row.role,
  isActive: row.is_active,
});

export async function register(input: z.infer<typeof registerSchema>) {
  const existing = await sql<{ id: number }[]>`
    select id from users where lower(email) = lower(${input.email})`;
  if (existing.length > 0) {
    throw new ApiError(409, "CONFLICT", "An account with that email already exists.");
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
  const [row] = await sql<UserRow[]>`
    insert into users (email, password_hash, full_name, role)
    values (${input.email.toLowerCase()}, ${passwordHash}, ${input.fullName}, 'MEMBER')
    returning id, email, full_name, role, is_active, password_hash`;

  // Every user has exactly one profile row; create it up front so the 1:1 holds.
  await sql`insert into profiles (user_id) values (${row.id})`;

  const user = toPublicUser(row);
  return { user, token: await signSession({ userId: user.id, email: user.email, role: user.role }) };
}

export async function login(input: z.infer<typeof loginSchema>) {
  const [row] = await sql<UserRow[]>`
    select id, email, full_name, role, is_active, password_hash
    from users where lower(email) = lower(${input.email})`;

  // Same response whether the email is unknown or the password is wrong, so the
  // endpoint cannot be used to enumerate accounts.
  const invalid = new ApiError(401, "UNAUTHENTICATED", "Invalid email or password.");
  if (!row) throw invalid;
  if (!(await bcrypt.compare(input.password, row.password_hash))) throw invalid;
  if (!row.is_active) {
    throw new ApiError(403, "FORBIDDEN", "This account has been deactivated.");
  }

  const user = toPublicUser(row);
  return { user, token: await signSession({ userId: user.id, email: user.email, role: user.role }) };
}

export async function me(userId: number): Promise<PublicUser> {
  const [row] = await sql<UserRow[]>`
    select id, email, full_name, role, is_active, password_hash
    from users where id = ${userId}`;
  if (!row) throw new ApiError(404, "NOT_FOUND", "User not found.");
  return toPublicUser(row);
}
