import { z } from "zod";
import { ApiError } from "@/lib/api/withApi";
import type { Session } from "@/lib/auth/guard";
import { get as getWorkout, requireWritable } from "@/lib/controllers/workouts.controller";
import { sql } from "@/lib/db";

export const createSchema = z.object({
  exerciseId: z.coerce.number().int().min(1),
  setNumber: z.coerce.number().int().min(1).max(99),
  reps: z.coerce.number().int().min(1).max(999),
  weightKg: z.coerce.number().min(0).max(9999).default(0),
  rpe: z.coerce.number().min(1).max(10).nullish(),
});

export const updateSchema = createSchema.partial();

export type WorkoutSet = {
  id: number;
  workoutId: number;
  exerciseId: number;
  exerciseName: string;
  setNumber: number;
  reps: number;
  weightKg: number;
  rpe: number | null;
};

type Row = {
  id: number;
  workout_id: number;
  exercise_id: number;
  exercise_name: string;
  set_number: number;
  reps: number;
  weight_kg: string | null;
  rpe: string | null;
};

const toSet = (row: Row): WorkoutSet => ({
  id: row.id,
  workoutId: row.workout_id,
  exerciseId: row.exercise_id,
  exerciseName: row.exercise_name,
  setNumber: row.set_number,
  reps: row.reps,
  weightKg: Number(row.weight_kg ?? 0),
  rpe: row.rpe === null ? null : Number(row.rpe),
});

/** Readable by anyone who may read the parent session. */
export async function listForWorkout(session: Session, workoutId: number): Promise<WorkoutSet[]> {
  await getWorkout(session, workoutId);
  const rows = await sql<Row[]>`
    select s.id, s.workout_id, s.exercise_id, e.name as exercise_name,
           s.set_number, s.reps, s.weight_kg, s.rpe
    from workout_sets s
    join exercises e on e.id = s.exercise_id
    where s.workout_id = ${workoutId}
    order by s.exercise_id, s.set_number`;
  return rows.map(toSet);
}

async function findOrThrow(workoutId: number, setId: number): Promise<Row> {
  const [row] = await sql<Row[]>`
    select s.id, s.workout_id, s.exercise_id, e.name as exercise_name,
           s.set_number, s.reps, s.weight_kg, s.rpe
    from workout_sets s
    join exercises e on e.id = s.exercise_id
    where s.id = ${setId} and s.workout_id = ${workoutId}`;
  if (!row) throw new ApiError(404, "NOT_FOUND", "Set not found in this workout.");
  return row;
}

export async function create(
  session: Session,
  workoutId: number,
  input: z.infer<typeof createSchema>,
): Promise<WorkoutSet> {
  await requireWritable(session, workoutId);

  const [exercise] = await sql<{ id: number }[]>`
    select id from exercises where id = ${input.exerciseId}`;
  if (!exercise) throw new ApiError(404, "NOT_FOUND", "Exercise not found.");

  try {
    const [row] = await sql<{ id: number }[]>`
      insert into workout_sets (workout_id, exercise_id, set_number, reps, weight_kg, rpe)
      values (${workoutId}, ${input.exerciseId}, ${input.setNumber}, ${input.reps},
              ${input.weightKg}, ${input.rpe ?? null})
      returning id`;
    return toSet(await findOrThrow(workoutId, row.id));
  } catch (err) {
    // 23505: the (workout, exercise, set_number) unique constraint from 0005.
    if ((err as { code?: string }).code === "23505") {
      throw new ApiError(409, "CONFLICT", "That set number already exists for this exercise.");
    }
    throw err;
  }
}

export async function update(
  session: Session,
  workoutId: number,
  setId: number,
  input: z.infer<typeof updateSchema>,
): Promise<WorkoutSet> {
  await requireWritable(session, workoutId);
  const current = await findOrThrow(workoutId, setId);

  await sql`
    update workout_sets set
      set_number = ${input.setNumber ?? current.set_number},
      reps       = ${input.reps ?? current.reps},
      weight_kg  = ${input.weightKg ?? Number(current.weight_kg ?? 0)},
      rpe        = ${input.rpe === undefined ? current.rpe : input.rpe}
    where id = ${setId}`;
  return toSet(await findOrThrow(workoutId, setId));
}

export async function remove(session: Session, workoutId: number, setId: number): Promise<void> {
  await requireWritable(session, workoutId);
  await findOrThrow(workoutId, setId);
  await sql`delete from workout_sets where id = ${setId}`;
}
