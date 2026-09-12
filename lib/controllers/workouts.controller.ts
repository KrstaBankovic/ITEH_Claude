import { z } from "zod";
import { ApiError } from "@/lib/api/withApi";
import type { Session } from "@/lib/auth/guard";
import { sql } from "@/lib/db";

export const PAGE_SIZE = 20;

export const listQuerySchema = z.object({
  userId: z.coerce.number().int().min(1).optional(),
  planId: z.coerce.number().int().min(1).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export const createSchema = z.object({
  performedAt: z.union([z.string().datetime({ offset: true }), z.string().date()]),
  planId: z.coerce.number().int().min(1).nullish(),
  durationMin: z.coerce.number().int().min(1).max(600).nullish(),
  notes: z.string().trim().max(2000).nullish(),
});

export const updateSchema = createSchema.partial();

export type Workout = {
  id: number;
  userId: number;
  userName: string;
  planId: number | null;
  planTitle: string | null;
  performedAt: string;
  durationMin: number | null;
  notes: string | null;
  setCount: number;
  totalVolumeKg: number;
};

type Row = {
  id: number;
  user_id: number;
  user_name: string;
  plan_id: number | null;
  plan_title: string | null;
  performed_at: Date;
  duration_min: number | null;
  notes: string | null;
  set_count: string;
  total_volume_kg: string | null;
};

const toWorkout = (row: Row): Workout => ({
  id: row.id,
  userId: row.user_id,
  userName: row.user_name,
  planId: row.plan_id,
  planTitle: row.plan_title,
  performedAt: row.performed_at.toISOString(),
  durationMin: row.duration_min,
  notes: row.notes,
  setCount: Number(row.set_count),
  totalVolumeKg: Number(row.total_volume_kg ?? 0),
});

/** True when the trainer owns a plan belonging to this member. */
async function isAssignedTrainer(trainerId: number, memberId: number): Promise<boolean> {
  const [row] = await sql<{ ok: number }[]>`
    select 1 as ok from workout_plans
    where trainer_id = ${trainerId} and owner_id = ${memberId} limit 1`;
  return Boolean(row);
}

/** Members whose plans this trainer owns. */
export async function assignedMemberIds(trainerId: number): Promise<number[]> {
  const rows = await sql<{ owner_id: number }[]>`
    select distinct owner_id from workout_plans
    where trainer_id = ${trainerId} and owner_id <> ${trainerId}`;
  return rows.map((row) => row.owner_id);
}

export async function list(session: Session, query: z.infer<typeof listQuerySchema>) {
  let userId = session.userId;
  if (query.userId && query.userId !== session.userId) {
    // Reading someone else's log is allowed for an admin, or a trainer they train with.
    if (session.role === "ADMIN") {
      userId = query.userId;
    } else if (session.role === "TRAINER" && (await isAssignedTrainer(session.userId, query.userId))) {
      userId = query.userId;
    } else {
      throw new ApiError(403, "FORBIDDEN", "You cannot read that member's workouts.");
    }
  }

  const planId = query.planId ?? null;
  const from = query.from ?? null;
  const to = query.to ?? null;
  const offset = (query.page - 1) * PAGE_SIZE;

  const rows = await sql<(Row & { total: string })[]>`
    select w.id, w.user_id, u.full_name as user_name, w.plan_id, p.title as plan_title,
           w.performed_at, w.duration_min, w.notes,
           count(s.id) as set_count,
           coalesce(sum(s.reps * s.weight_kg), 0) as total_volume_kg,
           count(*) over () as total
    from workouts w
    join users u on u.id = w.user_id
    left join workout_plans p on p.id = w.plan_id
    left join workout_sets s on s.workout_id = w.id
    where w.user_id = ${userId}
      and (${planId}::int is null or w.plan_id = ${planId}::int)
      and (${from}::date is null or w.performed_at >= ${from}::date)
      and (${to}::date is null or w.performed_at < (${to}::date + interval '1 day'))
    group by w.id, u.full_name, p.title
    order by w.performed_at desc
    limit ${PAGE_SIZE} offset ${offset}`;

  return {
    data: rows.map(toWorkout),
    meta: { page: query.page, pageSize: PAGE_SIZE, total: rows[0] ? Number(rows[0].total) : 0 },
  };
}

async function findOrThrow(id: number): Promise<Row> {
  const [row] = await sql<Row[]>`
    select w.id, w.user_id, u.full_name as user_name, w.plan_id, p.title as plan_title,
           w.performed_at, w.duration_min, w.notes,
           count(s.id) as set_count,
           coalesce(sum(s.reps * s.weight_kg), 0) as total_volume_kg
    from workouts w
    join users u on u.id = w.user_id
    left join workout_plans p on p.id = w.plan_id
    left join workout_sets s on s.workout_id = w.id
    where w.id = ${id}
    group by w.id, u.full_name, p.title`;
  if (!row) throw new ApiError(404, "NOT_FOUND", "Workout not found.");
  return row;
}

/** Owner, the member's trainer, or an admin may read a session. */
export async function get(session: Session, id: number): Promise<Workout> {
  const row = await findOrThrow(id);
  if (
    row.user_id !== session.userId &&
    session.role !== "ADMIN" &&
    !(session.role === "TRAINER" && (await isAssignedTrainer(session.userId, row.user_id)))
  ) {
    throw new ApiError(403, "FORBIDDEN", "You cannot read that workout.");
  }
  return toWorkout(row);
}

/** Only the owner or an admin may change a session. */
export async function requireWritable(session: Session, id: number): Promise<Workout> {
  const row = await findOrThrow(id);
  if (row.user_id !== session.userId && session.role !== "ADMIN") {
    throw new ApiError(403, "FORBIDDEN", "You cannot modify that workout.");
  }
  return toWorkout(row);
}

export async function create(
  session: Session,
  input: z.infer<typeof createSchema>,
): Promise<Workout> {
  if (input.planId) {
    const [plan] = await sql<{ id: number }[]>`
      select id from workout_plans
      where id = ${input.planId} and (owner_id = ${session.userId} or is_template = true)`;
    if (!plan) throw new ApiError(404, "NOT_FOUND", "Plan not found.");
  }

  const [row] = await sql<{ id: number }[]>`
    insert into workouts (user_id, plan_id, performed_at, duration_min, notes)
    values (${session.userId}, ${input.planId ?? null}, ${input.performedAt},
            ${input.durationMin ?? null}, ${input.notes ?? null})
    returning id`;
  return get(session, row.id);
}

export async function update(
  session: Session,
  id: number,
  input: z.infer<typeof updateSchema>,
): Promise<Workout> {
  const current = await requireWritable(session, id);
  await sql`
    update workouts set
      performed_at = ${input.performedAt ?? current.performedAt},
      plan_id      = ${input.planId === undefined ? current.planId : input.planId},
      duration_min = ${input.durationMin === undefined ? current.durationMin : input.durationMin},
      notes        = ${input.notes === undefined ? current.notes : input.notes}
    where id = ${id}`;
  return get(session, id);
}

export async function remove(session: Session, id: number): Promise<void> {
  await requireWritable(session, id);
  // workout_sets has ON DELETE CASCADE, so the sets go with the session.
  await sql`delete from workouts where id = ${id}`;
}
