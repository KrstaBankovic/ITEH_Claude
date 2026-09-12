import { z } from "zod";
import type { Session } from "@/lib/auth/guard";
import { oneRepMaxTrend, type OneRepMaxPoint, type SetSample } from "@/lib/analytics/oneRepMax";
import { sql } from "@/lib/db";

export const progressQuerySchema = z.object({
  exerciseId: z.coerce.number().int().min(1),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

export type Overview = {
  sessionCount: number;
  totalVolumeKg: number;
  setsLast7Days: number;
  activeGoals: number;
  volumeByDay: { day: string; volumeKg: number }[];
  loggedExercises: { id: number; name: string; setCount: number }[];
};

export async function overview(session: Session): Promise<Overview> {
  const userId = session.userId;

  // Every figure is aggregated by Postgres; no row sets are pulled into JS to be summed.
  const [totals] = await sql<
    {
      session_count: number;
      total_volume_kg: string;
      sets_last_7_days: number;
      active_goals: number;
    }[]
  >`
    select
      (select count(*)::int from workouts where user_id = ${userId}) as session_count,
      (select coalesce(sum(s.reps * s.weight_kg), 0)
         from workout_sets s join workouts w on w.id = s.workout_id
        where w.user_id = ${userId}) as total_volume_kg,
      (select count(*)::int
         from workout_sets s join workouts w on w.id = s.workout_id
        where w.user_id = ${userId}
          and w.performed_at >= now() - interval '7 days') as sets_last_7_days,
      (select count(*)::int from goals
        where user_id = ${userId} and status = 'ACTIVE') as active_goals`;

  // generate_series zero-fills rest days, so the chart has no gaps.
  const volume = await sql<{ day: Date; volume_kg: string }[]>`
    select day::date as day, coalesce(sum(s.reps * s.weight_kg), 0) as volume_kg
    from generate_series(current_date - interval '6 days', current_date, interval '1 day') as day
    left join workouts w
      on w.user_id = ${userId}
     and w.performed_at >= day
     and w.performed_at < day + interval '1 day'
    left join workout_sets s on s.workout_id = w.id
    group by day
    order by day`;

  const logged = await sql<{ id: number; name: string; set_count: number }[]>`
    select e.id, e.name, count(*)::int as set_count
    from workout_sets s
    join workouts w on w.id = s.workout_id
    join exercises e on e.id = s.exercise_id
    where w.user_id = ${userId}
    group by e.id, e.name
    order by count(*) desc, e.name`;

  return {
    sessionCount: totals.session_count,
    totalVolumeKg: Number(totals.total_volume_kg),
    setsLast7Days: totals.sets_last_7_days,
    activeGoals: totals.active_goals,
    volumeByDay: volume.map((row) => ({
      day: row.day.toISOString().slice(0, 10),
      volumeKg: Number(row.volume_kg),
    })),
    loggedExercises: logged.map((row) => ({
      id: row.id,
      name: row.name,
      setCount: row.set_count,
    })),
  };
}

export type Progress = {
  exerciseId: number;
  exerciseName: string;
  points: OneRepMaxPoint[];
};

export async function progress(
  session: Session,
  query: z.infer<typeof progressQuerySchema>,
): Promise<Progress> {
  const from = query.from ?? null;
  const to = query.to ?? null;

  const [exercise] = await sql<{ name: string }[]>`
    select name from exercises where id = ${query.exerciseId}`;

  // Postgres groups the set history down to the distinct weight/rep pairings per
  // day — a handful of rows — and the Epley estimate is then applied once, in
  // lib/analytics/oneRepMax.ts, so the formula is not duplicated in SQL.
  const rows = await sql<{ day: Date; weight_kg: string; reps: number }[]>`
    select date_trunc('day', w.performed_at)::date as day, s.weight_kg, s.reps
    from workout_sets s
    join workouts w on w.id = s.workout_id
    where w.user_id = ${session.userId}
      and s.exercise_id = ${query.exerciseId}
      and (${from}::date is null or w.performed_at >= ${from}::date)
      and (${to}::date is null or w.performed_at < (${to}::date + interval '1 day'))
    group by 1, s.weight_kg, s.reps
    order by 1`;

  const samples: SetSample[] = rows.map((row) => ({
    day: row.day.toISOString().slice(0, 10),
    weightKg: Number(row.weight_kg),
    reps: row.reps,
  }));

  return {
    exerciseId: query.exerciseId,
    exerciseName: exercise?.name ?? "Unknown exercise",
    points: oneRepMaxTrend(samples),
  };
}
