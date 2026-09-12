import { z } from "zod";
import { ApiError } from "@/lib/api/withApi";
import { ROLES, type Role, type Session } from "@/lib/auth/guard";
import { sql } from "@/lib/db";

export const listQuerySchema = z.object({
  role: z.enum(ROLES).optional(),
  active: z.enum(["true", "false"]).optional(),
});

export const updateUserSchema = z
  .object({
    role: z.enum(ROLES).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => value.role !== undefined || value.isActive !== undefined, {
    message: "Provide role or isActive.",
  });

export type AdminUser = {
  id: number;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  workoutCount: number;
};

type Row = {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  created_at: Date;
  workout_count: number;
};

const toAdminUser = (row: Row): AdminUser => ({
  id: row.id,
  email: row.email,
  fullName: row.full_name,
  role: row.role,
  isActive: row.is_active,
  createdAt: row.created_at.toISOString(),
  workoutCount: row.workout_count,
});

export async function listUsers(query: z.infer<typeof listQuerySchema>): Promise<AdminUser[]> {
  const role = query.role ?? null;
  const active = query.active === undefined ? null : query.active === "true";

  const rows = await sql<Row[]>`
    select u.id, u.email, u.full_name, u.role, u.is_active, u.created_at,
           count(w.id)::int as workout_count
    from users u
    left join workouts w on w.user_id = u.id
    where (${role}::text is null or u.role = ${role}::text)
      and (${active}::boolean is null or u.is_active = ${active}::boolean)
    group by u.id
    order by u.id`;
  return rows.map(toAdminUser);
}

export async function updateUser(
  session: Session,
  id: number,
  input: z.infer<typeof updateUserSchema>,
): Promise<AdminUser> {
  const [current] = await sql<Row[]>`
    select u.id, u.email, u.full_name, u.role, u.is_active, u.created_at, 0 as workout_count
    from users u where u.id = ${id}`;
  if (!current) throw new ApiError(404, "NOT_FOUND", "User not found.");

  // An admin locking or demoting their own account would leave nobody in charge.
  if (id === session.userId) {
    if (input.role !== undefined && input.role !== "ADMIN") {
      throw new ApiError(409, "CONFLICT", "You cannot change your own role.");
    }
    if (input.isActive === false) {
      throw new ApiError(409, "CONFLICT", "You cannot deactivate your own account.");
    }
  }

  await sql`
    update users set
      role       = ${input.role ?? current.role},
      is_active  = ${input.isActive ?? current.is_active},
      updated_at = now()
    where id = ${id}`;

  const [updated] = await sql<Row[]>`
    select u.id, u.email, u.full_name, u.role, u.is_active, u.created_at,
           count(w.id)::int as workout_count
    from users u
    left join workouts w on w.user_id = u.id
    where u.id = ${id}
    group by u.id`;
  return toAdminUser(updated);
}
