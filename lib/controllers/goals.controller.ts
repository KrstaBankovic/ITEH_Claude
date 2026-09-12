import { z } from "zod";
import { ApiError } from "@/lib/api/withApi";
import type { Session } from "@/lib/auth/guard";
import { sql } from "@/lib/db";
import { GOAL_STATUSES, GOAL_TYPES, type GoalStatus, type GoalType } from "@/lib/domain";

export const createSchema = z.object({
  exerciseId: z.coerce.number().int().min(1).nullish(),
  goalType: z.enum(GOAL_TYPES),
  targetValue: z.coerce.number().positive().max(999_999),
  unit: z.string().trim().min(1).max(12),
  deadline: z.string().date().nullish(),
  status: z.enum(GOAL_STATUSES).default("ACTIVE"),
});

export const updateSchema = createSchema.partial();

export type Goal = {
  id: number;
  exerciseId: number | null;
  exerciseName: string | null;
  goalType: GoalType;
  targetValue: number;
  currentValue: number;
  progressPct: number;
  unit: string;
  deadline: string | null;
  status: GoalStatus;
};

type Row = {
  id: number;
  exercise_id: number | null;
  exercise_name: string | null;
  goal_type: GoalType;
  target_value: string;
  current_value: string | null;
  unit: string;
  deadline: Date | null;
  status: GoalStatus;
};

function toGoal(row: Row): Goal {
  const target = Number(row.target_value);
  const current = Number(row.current_value ?? 0);
  return {
    id: row.id,
    exerciseId: row.exercise_id,
    exerciseName: row.exercise_name,
    goalType: row.goal_type,
    targetValue: target,
    currentValue: Math.round(current * 100) / 100,
    progressPct: target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0,
    unit: row.unit,
    deadline: row.deadline ? row.deadline.toISOString().slice(0, 10) : null,
    status: row.status,
  };
}

/**
 * Each goal type measures something different, so the achieved-so-far figure is
 * resolved per type by Postgres in the same pass that reads the goals.
 */
const SELECT_GOALS = (userId: number) => sql<Row[]>`
  select g.id, g.exercise_id, e.name as exercise_name, g.goal_type, g.target_value,
         g.unit, g.deadline, g.status,
         case g.goal_type
           when 'MAX_WEIGHT' then (
             select max(s.weight_kg)::numeric
             from workout_sets s join workouts w on w.id = s.workout_id
             where w.user_id = g.user_id and s.exercise_id = g.exercise_id)
           when 'TOTAL_VOLUME' then (
             select coalesce(sum(s.reps * s.weight_kg), 0)::numeric
             from workout_sets s join workouts w on w.id = s.workout_id
             where w.user_id = g.user_id)
           when 'SESSION_COUNT' then (
             select count(*)::numeric from workouts w where w.user_id = g.user_id)
           when 'BODY_WEIGHT' then (
             select p.weight_kg::numeric from profiles p where p.user_id = g.user_id)
         end as current_value
  from goals g
  left join exercises e on e.id = g.exercise_id
  where g.user_id = ${userId}
  order by case g.status when 'ACTIVE' then 0 when 'ACHIEVED' then 1 else 2 end,
           g.deadline nulls last, g.id`;

export async function list(session: Session): Promise<Goal[]> {
  const rows = await SELECT_GOALS(session.userId);
  return rows.map(toGoal);
}

async function findOwned(session: Session, id: number): Promise<Goal> {
  const rows = await SELECT_GOALS(session.userId);
  const goal = rows.map(toGoal).find((candidate) => candidate.id === id);
  if (!goal) {
    // Also covers someone else's goal: not found rather than a hint that it exists.
    throw new ApiError(404, "NOT_FOUND", "Goal not found.");
  }
  return goal;
}

export async function create(
  session: Session,
  input: z.infer<typeof createSchema>,
): Promise<Goal> {
  if (input.goalType === "MAX_WEIGHT" && !input.exerciseId) {
    throw new ApiError(422, "VALIDATION_ERROR", "A max-weight goal needs an exercise.");
  }
  if (input.exerciseId) {
    const [exercise] = await sql<{ id: number }[]>`
      select id from exercises where id = ${input.exerciseId}`;
    if (!exercise) throw new ApiError(404, "NOT_FOUND", "Exercise not found.");
  }

  const [row] = await sql<{ id: number }[]>`
    insert into goals (user_id, exercise_id, goal_type, target_value, unit, deadline, status)
    values (${session.userId}, ${input.exerciseId ?? null}, ${input.goalType},
            ${input.targetValue}, ${input.unit}, ${input.deadline ?? null}, ${input.status})
    returning id`;
  return findOwned(session, row.id);
}

export async function update(
  session: Session,
  id: number,
  input: z.infer<typeof updateSchema>,
): Promise<Goal> {
  const current = await findOwned(session, id);
  await sql`
    update goals set
      target_value = ${input.targetValue ?? current.targetValue},
      unit         = ${input.unit ?? current.unit},
      deadline     = ${input.deadline === undefined ? current.deadline : input.deadline},
      status       = ${input.status ?? current.status}
    where id = ${id} and user_id = ${session.userId}`;
  return findOwned(session, id);
}

export async function remove(session: Session, id: number): Promise<void> {
  await findOwned(session, id);
  await sql`delete from goals where id = ${id} and user_id = ${session.userId}`;
}
