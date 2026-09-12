-- CREATE TABLE: the two tables every other table references.

create table users (
  id              serial primary key,
  email           varchar(255) not null unique,
  password_hash   varchar(255) not null,
  full_name       varchar(120) not null,
  role            varchar(16)  not null default 'MEMBER'
                  check (role in ('MEMBER', 'TRAINER', 'ADMIN')),
  is_active       boolean      not null default true,
  -- Carried over from the pre-migration prototype, superseded by `email`.
  -- Dropped again in 0006.
  legacy_username varchar(60),
  created_at      timestamptz  not null default now(),
  updated_at      timestamptz  not null default now()
);

create table exercises (
  id           serial primary key,
  name         varchar(120) not null,
  muscle_group varchar(40)  not null,
  equipment    varchar(40),
  -- Left nullable on purpose; 0004 tightens it to not null.
  is_public    boolean      default true,
  created_by   integer      references users (id) on delete set null,
  created_at   timestamptz  not null default now()
);
