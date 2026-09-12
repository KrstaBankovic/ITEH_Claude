-- CREATE TABLE, then ALTER TABLE ... ADD COLUMN.
-- weight_kg is deliberately smallint here so that 0004 has a real column type to
-- widen; body weight needs a decimal place, which smallint cannot hold.

create table profiles (
  user_id    integer primary key references users (id) on delete cascade,
  birth_date date,
  height_cm  smallint,
  weight_kg  smallint
);

alter table profiles add column bio text;

alter table profiles add column experience_level varchar(16)
  check (experience_level in ('BEGINNER', 'INTERMEDIATE', 'ADVANCED'));
