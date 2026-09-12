-- ADD CONSTRAINT (CHECK and UNIQUE) plus CREATE INDEX.
-- The range checks and composite uniques are added here rather than inline in
-- 0001/0002 so that this migration carries real work.

alter table workout_plans
  add constraint workout_plans_days_per_week_check
  check (days_per_week between 1 and 7);

alter table plan_exercises
  add constraint plan_exercises_day_index_check
  check (day_index between 1 and 7);

alter table workout_sets
  add constraint workout_sets_reps_check      check (reps > 0),
  add constraint workout_sets_weight_kg_check check (weight_kg >= 0),
  add constraint workout_sets_rpe_check       check (rpe is null or rpe between 1 and 10);

alter table exercises
  add constraint exercises_name_created_by_key unique (name, created_by);

alter table plan_exercises
  add constraint plan_exercises_plan_day_order_key unique (plan_id, day_index, order_index);

alter table workout_sets
  add constraint workout_sets_workout_exercise_set_key unique (workout_id, exercise_id, set_number);

-- The workout list is always "this user, newest first".
create index workouts_user_performed_idx on workouts (user_id, performed_at desc);

-- The 1RM trend and progress endpoints filter sets by exercise.
create index workout_sets_exercise_idx on workout_sets (exercise_id);

create index goals_user_status_idx on goals (user_id, status);
