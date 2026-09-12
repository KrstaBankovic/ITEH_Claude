-- DROP COLUMN and ADD CONSTRAINT ... FOREIGN KEY.

-- Superseded by users.email in 0001; nothing reads it.
alter table users drop column legacy_username;

-- The nullable self-reference: the trainer who owns a member's plan.
alter table workout_plans
  add constraint workout_plans_trainer_id_fkey
  foreign key (trainer_id) references users (id) on delete set null;
