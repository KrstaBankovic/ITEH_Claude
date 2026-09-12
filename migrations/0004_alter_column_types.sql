-- ALTER COLUMN TYPE, ALTER COLUMN SET NOT NULL, ALTER COLUMN SET DEFAULT.

-- Body weight is recorded to one decimal place; smallint cannot store 82.5.
alter table profiles alter column weight_kg type numeric(5,2);

-- A visibility flag with three states (true / false / null) is a bug waiting to
-- happen, and every row already has the default.
alter table exercises alter column is_public set not null;

-- Most members train three days a week.
alter table workout_plans alter column days_per_week set default 3;
