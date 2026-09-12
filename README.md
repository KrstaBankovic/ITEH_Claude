# GymTracker

A gym workout tracker: log training sessions set by set, track strength goals, and see
whether the numbers are actually going up. Trainers build workout plans and assign them
to members; administrators manage accounts and roles.

Coursework for ITEH (FON). The full specification is in
[`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md); the API reference is in
[`docs/API.md`](docs/API.md).

**Deployed at:** _not deployed yet — paste the Vercel URL here._

## Features

- Session logging with a rest timer between sets, sets recorded with reps, weight and RPE
- Estimated one-rep-max trend per exercise (Epley) and weekly training volume, charted
- Goals with progress computed from the training log: max weight, total volume, session
  count, body weight
- Searchable exercise catalog with debounced multi-criteria filtering
- Three roles — `MEMBER`, `TRAINER`, `ADMIN` — enforced in middleware and in every API
  handler
- Own authentication: bcrypt password hashing, JWT session in an httpOnly cookie

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), TypeScript `strict` |
| Styling | Tailwind CSS v4 |
| Database | Supabase Postgres, used as a plain Postgres host |
| DB driver | postgres.js, `prepare: false` behind the transaction pooler |
| Migrations | hand-written SQL plus a custom runner |
| Auth | `jose` (JWT, HS256) and `bcryptjs`, no third-party auth service |
| Validation | `zod` |
| Charts | `recharts` |

## Local setup

Requires Node 22 and a Supabase Postgres project.

```bash
npm install
cp .env.example .env.local     # then fill in the three values
npm run db:reset               # runs every migration, then seeds
npm run dev                    # http://localhost:3000
```

`.env.local` needs three values:

| Variable | What it is |
|---|---|
| `DATABASE_URL` | Supabase **transaction pooler**, port `6543`. Used by the app at runtime. |
| `DIRECT_URL` | Supabase **session pooler**, port `5432`. Used by the migration and seed scripts. |
| `JWT_SECRET` | 32+ random bytes for signing the session cookie. |

The two connection strings differ only in the port. The runtime must use `6543`, where
transaction pooling forbids prepared statements — hence `prepare: false` in
[`lib/db.ts`](lib/db.ts).

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | development server |
| `npm run build` | production build |
| `npm run lint` | ESLint |
| `npm run db:migrate` | applies any migration not yet in `_migrations` |
| `npm run db:seed` | truncates and reseeds the demo dataset |
| `npm run db:reset` | drops every table, re-runs all migrations, then seeds |

`db:reset` is safe to run repeatedly; it is the quickest way back to a known state.

## Demo accounts

Seeded by `npm run db:seed`. Every account uses the password **`Password123!`**

| Role | Email |
|---|---|
| `ADMIN` | `admin@gymtracker.local` |
| `TRAINER` | `trainer1@gymtracker.local` |
| `TRAINER` | `trainer2@gymtracker.local` |
| `MEMBER` | `member1@gymtracker.local` |
| `MEMBER` | `member2@gymtracker.local` … `member5@gymtracker.local` |

`member1` has the fullest history (18 sessions), so it is the best account for looking at
the dashboard charts. The seed is deterministic: the same dataset comes back after every
`db:reset`.

Seeded volume: 8 users, 26 exercises, 3 plans, 40 sessions, 360 sets and 8 goals spread
over the last 90 days.

## Database

Eight related tables — `users`, `profiles`, `exercises`, `workout_plans`,
`plan_exercises`, `workouts`, `workout_sets`, `goals` — created by six migrations in
[`migrations/`](migrations), applied in lexical order and tracked in `_migrations`.
Each file runs inside its own transaction, and applied files are never edited: a
correction is a new migration.

The six files cover seven distinct operation types: `CREATE TABLE`, `FOREIGN KEY`,
`ADD COLUMN`, `ALTER COLUMN TYPE`, `SET NOT NULL` / `SET DEFAULT`, `ADD CONSTRAINT`
(check and unique) with `CREATE INDEX`, and `DROP COLUMN`.

## Project layout

```
app/                 pages and API route handlers (thin wrappers)
  api/…              route handlers: parse, guard, call a controller, serialise
components/ui/       Button, Input, Card, Modal, Navbar, Badge
hooks/               useRestTimer, useDebouncedFilter
lib/
  analytics/         one-rep-max estimation
  api/               withApi wrapper, ApiError, client fetch helper
  auth/guard.ts      getSession, requireAuth, requireRole
  controllers/       business logic, one module per resource
  db.ts              postgres.js client
migrations/          hand-written SQL, forward only
scripts/             migrate.mjs, seed.mjs
middleware.ts        page-level route protection
```

Business logic lives in `lib/controllers/`; every `route.ts` only reads input, calls a
guard, calls a controller and serialises the result. A shared `withApi()` wrapper turns a
thrown `ApiError` into the JSON error envelope, so no handler contains a `try`/`catch`.

## Deploying

Set `DATABASE_URL`, `DIRECT_URL` and `JWT_SECRET` in the Vercel project settings by hand,
then deploy. Run `npm run db:reset` locally against the same database to create and seed
the schema — migrations are not run during the build.

Handlers that hash or compare passwords declare `export const runtime = "nodejs"`, since
`bcryptjs` does not run on the Edge runtime.
