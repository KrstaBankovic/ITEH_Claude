-- CREATE TABLE + FOREIGN KEY: sessions, plans, sets and goals.
-- workout_plans.trainer_id is created here as a plain integer column; its foreign
-- key back to users is added in 0006.

create table workout_plans (
  id            serial primary key,
  owner_id      integer      not null references users (id) on delete cascade,
  trainer_id    integer,
  title         varchar(120) not null,
  description   text,
  days_per_week smallint,
  is_template   boolean      default false,
  created_at    timestamptz  not null default now()
);

create table plan_exercises (
  id          serial primary key,
  plan_id     integer  not null references workout_plans (id) on delete cascade,
  exercise_id integer  not null references exercises (id),
  day_index   smallint not null,
  target_sets smallint,
  target_reps smallint,
  order_index smallint not null
);

create table workouts (
  id           serial primary key,
  user_id      integer     not null references users (id) on delete cascade,
  plan_id      integer     references workout_plans (id) on delete set null,
  performed_at timestamptz not null,
  duration_min smallint,
  notes        text,
  created_at   timestamptz not null default now()
);

create table workout_sets (
  id          serial primary key,
  workout_id  integer  not null references workouts (id) on delete cascade,
  exercise_id integer  not null references exercises (id),
  set_number  smallint not null,
  reps        smallint not null,
  weight_kg   numeric(6,2),
  rpe         numeric(3,1)
);

create table goals (
  id           serial primary key,
  user_id      integer      not null references users (id) on delete cascade,
  exercise_id  integer      references exercises (id) on delete set null,
  goal_type    varchar(24)  not null
               check (goal_type in ('MAX_WEIGHT', 'TOTAL_VOLUME', 'SESSION_COUNT', 'BODY_WEIGHT')),
  target_value numeric(8,2) not null,
  unit         varchar(12)  not null,
  deadline     date,
  status       varchar(12)  not null default 'ACTIVE'
               check (status in ('ACTIVE', 'ACHIEVED', 'ABANDONED')),
  created_at   timestamptz  not null default now()
);
