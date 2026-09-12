import { z } from "zod";
import { ApiError } from "@/lib/api/withApi";
import type { Session } from "@/lib/auth/guard";
import { sql } from "@/lib/db";

export const createSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).nullish(),
  daysPerWeek: z.coerce.number().int().min(1).max(7).default(3),
  isTemplate: z.boolean().default(false),
  ownerId: z.coerce.number().int().min(1).nullish(),
});

export const updateSchema = createSchema.partial();

export const assignSchema = z.object({
  userId: z.coerce.number().int().min(1),
});

export type PlanExercise = {
  id: number;
  exerciseId: number;
  exerciseName: string;
  dayIndex: number;
  targetSets: number | null;
  targetReps: number | null;
  orderIndex: number;
};

export type Plan = {
  id: number;
  ownerId: number;
  ownerName: string;
  trainerId: number | null;
  trainerName: string | null;
  title: string;
  description: string | null;
  daysPerWeek: number | null;
  isTemplate: boolean;
  exercises?: PlanExercise[];
};

type Row = {
  id: number;
  owner_id: number;
  owner_name: string;
  trainer_id: number | null;
  trainer_name: string | null;
  title: string;
  description: string | null;
  days_per_week: number | null;
  is_template: boolean;
};

const toPlan = (row: Row): Plan => ({
  id: row.id,
  ownerId: row.owner_id,
  ownerName: row.owner_name,
  trainerId: row.trainer_id,
  trainerName: row.trainer_name,
  title: row.title,
  description: row.description,
  daysPerWeek: row.days_per_week,
  isTemplate: row.is_template,
});

/**
 * A plan is visible when you own it, you are its trainer, it is a public template,
 * or you are an admin. Enforced in SQL so the list and the detail read agree.
 */
export async function list(session: Session): Promise<Plan[]> {
  const isAdmin = session.role === "ADMIN";
  const rows = await sql<Row[]>`
    select p.id, p.owner_id, o.full_name as owner_name, p.trainer_id,
           t.full_name as trainer_name, p.title, p.description, p.days_per_week, p.is_template
    from workout_plans p
    join users o on o.id = p.owner_id
    left join users t on t.id = p.trainer_id
    where ${isAdmin}
       or p.owner_id = ${session.userId}
       or p.trainer_id = ${session.userId}
       or p.is_template = true
    order by p.is_template desc, p.title`;
  return rows.map(toPlan);
}

export async function get(session: Session, id: number): Promise<Plan> {
  const [row] = await sql<Row[]>`
    select p.id, p.owner_id, o.full_name as owner_name, p.trainer_id,
           t.full_name as trainer_name, p.title, p.description, p.days_per_week, p.is_template
    from workout_plans p
    join users o on o.id = p.owner_id
    left join users t on t.id = p.trainer_id
    where p.id = ${id}`;
  if (!row) throw new ApiError(404, "NOT_FOUND", "Plan not found.");

  const visible =
    session.role === "ADMIN" ||
    row.owner_id === session.userId ||
    row.trainer_id === session.userId ||
    row.is_template;
  if (!visible) throw new ApiError(403, "FORBIDDEN", "You cannot read that plan.");

  const exercises = await sql<
    {
      id: number;
      exercise_id: number;
      exercise_name: string;
      day_index: number;
      target_sets: number | null;
      target_reps: number | null;
      order_index: number;
    }[]
  >`
    select pe.id, pe.exercise_id, e.name as exercise_name, pe.day_index,
           pe.target_sets, pe.target_reps, pe.order_index
    from plan_exercises pe
    join exercises e on e.id = pe.exercise_id
    where pe.plan_id = ${id}
    order by pe.day_index, pe.order_index`;

  return {
    ...toPlan(row),
    exercises: exercises.map((exercise) => ({
      id: exercise.id,
      exerciseId: exercise.exercise_id,
      exerciseName: exercise.exercise_name,
      dayIndex: exercise.day_index,
      targetSets: exercise.target_sets,
      targetReps: exercise.target_reps,
      orderIndex: exercise.order_index,
    })),
  };
}

/** Only the owning trainer or an admin may change a plan. */
async function requireWritable(session: Session, id: number): Promise<Plan> {
  const plan = await get(session, id);
  if (session.role !== "ADMIN" && plan.trainerId !== session.userId) {
    throw new ApiError(403, "FORBIDDEN", "You can only edit plans you created.");
  }
  return plan;
}

export async function create(
  session: Session,
  input: z.infer<typeof createSchema>,
): Promise<Plan> {
  const ownerId = input.ownerId ?? session.userId;
  if (ownerId !== session.userId) {
    const [owner] = await sql<{ id: number }[]>`select id from users where id = ${ownerId}`;
    if (!owner) throw new ApiError(404, "NOT_FOUND", "Owner not found.");
  }

  const [row] = await sql<{ id: number }[]>`
    insert into workout_plans (owner_id, trainer_id, title, description, days_per_week, is_template)
    values (${ownerId}, ${session.userId}, ${input.title}, ${input.description ?? null},
            ${input.daysPerWeek}, ${input.isTemplate})
    returning id`;
  return get(session, row.id);
}

export async function update(
  session: Session,
  id: number,
  input: z.infer<typeof updateSchema>,
): Promise<Plan> {
  const current = await requireWritable(session, id);
  await sql`
    update workout_plans set
      title         = ${input.title ?? current.title},
      description   = ${input.description === undefined ? current.description : input.description},
      days_per_week = ${input.daysPerWeek ?? current.daysPerWeek},
      is_template   = ${input.isTemplate ?? current.isTemplate}
    where id = ${id}`;
  return get(session, id);
}

export async function remove(session: Session, id: number): Promise<void> {
  await requireWritable(session, id);
  // plan_exercises cascades; workouts.plan_id is set null by the 0002 foreign key.
  await sql`delete from workout_plans where id = ${id}`;
}

/**
 * Assigning copies the plan to the member, so the template keeps its own identity
 * and the member ends up owning a plan whose trainer is the assigner.
 */
export async function assign(session: Session, id: number, memberId: number): Promise<Plan> {
  const source = await get(session, id);
  if (session.role !== "ADMIN" && source.trainerId !== session.userId) {
    throw new ApiError(403, "FORBIDDEN", "You can only assign plans you created.");
  }

  const [member] = await sql<{ id: number; role: string }[]>`
    select id, role from users where id = ${memberId} and is_active = true`;
  if (!member) throw new ApiError(404, "NOT_FOUND", "Member not found.");

  const [row] = await sql<{ id: number }[]>`
    insert into workout_plans (owner_id, trainer_id, title, description, days_per_week, is_template)
    values (${memberId}, ${session.userId}, ${source.title}, ${source.description},
            ${source.daysPerWeek}, false)
    returning id`;

  await sql`
    insert into plan_exercises (plan_id, exercise_id, day_index, target_sets, target_reps, order_index)
    select ${row.id}, exercise_id, day_index, target_sets, target_reps, order_index
    from plan_exercises where plan_id = ${id}`;

  return get(session, row.id);
}
