# GymTracker — Implementation Plan

> **Course:** ITEH, FON — Katedra za elektronsko poslovanje
> **Repo A (this one):** `~/KRSTA/ITEH_Claude` · **Repo B:** `ITEH_Gemini`
> **Status:** decisions resolved, ready to hand to the CLI phase by phase.
> **Purpose:** one fixed specification, implemented twice — once by Claude Code, once by Gemini CLI — so the two runs can be compared.

---

## 1. Scope and comparison protocol

| | Repo A | Repo B |
|---|---|---|
| Agent | Claude Code | Gemini CLI (free tier) |
| Repo | `ITEH_Claude` | `ITEH_Gemini` |
| Spec source | this file, unchanged | this file, unchanged |
| Deploy | Vercel | Vercel |
| DB | Supabase project A | Supabase project B |

**Fairness rules:**

1. The same phase prompts (§12) are used verbatim for both agents. No extra hand-holding on one side.
2. Both runs start from an empty repo containing only this plan file and a `README.md`.
3. Pin the model for each run and record it. A mid-run model switch invalidates the comparison.
4. Do not fix agent mistakes by hand. If the agent produces broken code, the *next prompt* fixes it, and that prompt counts toward that agent's total. Silent human repair is the main way this kind of comparison gets corrupted.
5. Run B **after** A is finished, from the same plan. Do not update the plan in between — if the plan turns out to be wrong, note it and let both agents hit the same wall.
6. The planning phase itself is **not** measured (chat UI exposes no token counts). The comparison covers implementation only; say so explicitly in the write-up rather than leaving a gap.

---

## 2. Stack

| Layer | Choice | Note |
|---|---|---|
| Framework | Next.js 15+, App Router, TypeScript (strict) | satisfies "React or other frontend framework" |
| Styling | Tailwind CSS v4 | |
| DB | **Supabase Postgres** (standalone account, not the Vercel Marketplace entry) | |
| DB driver | `postgres` (postgres.js) | see pooler warning below |
| Migrations | hand-written SQL files + custom runner | deliberate — see §5 |
| Auth | JWT in httpOnly cookie, `jose` + `bcryptjs` | **not** Supabase Auth — the assignment wants our own auth controller |
| Validation | `zod` | |
| Charts | `recharts` | progress graphs |
| Tests | none | not required; keeps the token comparison about feature code |

**Supabase is used as a plain Postgres host only.** No `supabase-js`, no Supabase Auth, no RLS policies, no Storage. Reasons: the assignment explicitly requires our own `login` / `logout` / `register` controller and our own migrations, and leaning on Supabase's auth would satisfy neither. It also keeps the two repos identical in shape — Gemini gets the same plain-Postgres target.

> ⚠️ **Connection pooling gotcha.** Vercel runs serverless functions; each invocation opens its own connection, and Supabase's direct connection (port 5432) will exhaust its connection limit fast. Use the **Transaction pooler** connection string (port **6543**, Supavisor) for the app runtime. Transaction mode does not support prepared statements, so postgres.js must be created with `prepare: false` — without it, queries fail intermittently in production and work fine locally. Use the **direct** connection (port 5432) for the migration runner and seed script, which run from your machine, not from Vercel.

```ts
// lib/db.ts
import postgres from 'postgres';
export const sql = postgres(process.env.DATABASE_URL!, { prepare: false, ssl: 'require' });
```

Environment variables (set by hand in the Vercel dashboard — there is no marketplace integration to inject them):

```
DATABASE_URL=postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:6543/postgres
DIRECT_URL=postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:5432/postgres
JWT_SECRET=<32+ random bytes>
```

`.env.local` is gitignored; `.env.example` is committed with the keys and no values.

**Deliberately excluded:** Prisma and Drizzle. Both generate migrations, which makes the "3 different migration types" requirement hard to *show* in the documentation. Hand-written SQL means a professor can open `migrations/0004_alter_column_types.sql` and see exactly the required operation. It also keeps a large dependency out of the token comparison.

---

## 3. Roles

| Role | Can |
|---|---|
| `MEMBER` | CRUD own workouts, sets, goals; read public exercise catalog; read plans assigned to them |
| `TRAINER` | everything MEMBER can, plus: create/edit exercises, create workout plans, assign plans to members, read assigned members' workouts (read-only) |
| `ADMIN` | everything, plus: list/edit/deactivate users, change roles, delete any exercise |

Enforced in two places — middleware for page routes, `requireRole()` inside API handlers. Never rely on the UI hiding a button.

---

## 4. Data model

Eight tables, all interrelated (requirement: minimum 5). This is also the PMOV for the Faza 1 documentation (§15).

```
users ──1:1── profiles
  │
  ├──1:N── workout_plans (owner_id)      ┐
  ├──0:N── workout_plans (trainer_id)    ┘ nullable self-reference to a TRAINER
  ├──1:N── workouts
  ├──1:N── goals
  └──1:N── exercises (created_by)

workout_plans ──1:N── plan_exercises ──N:1── exercises
workouts ──1:N── workout_sets ──N:1── exercises
workouts ──N:1── workout_plans (nullable)
goals ──N:1── exercises (nullable)
```

**`users`**
| column | type | notes |
|---|---|---|
| `id` | `serial PK` | |
| `email` | `varchar(255)` | UNIQUE, NOT NULL |
| `password_hash` | `varchar(255)` | NOT NULL, bcrypt cost 10 |
| `full_name` | `varchar(120)` | NOT NULL |
| `role` | `varchar(16)` | NOT NULL, DEFAULT `'MEMBER'`, CHECK in (MEMBER, TRAINER, ADMIN) |
| `is_active` | `boolean` | NOT NULL DEFAULT true |
| `created_at` / `updated_at` | `timestamptz` | DEFAULT now() |

**`profiles`** — 1:1 with users; exists so the "add column" and "alter column" migrations have a natural home.
`user_id` (PK, FK→users ON DELETE CASCADE), `birth_date date`, `height_cm smallint`, `weight_kg numeric(5,2)`, `experience_level varchar(16)` CHECK in (BEGINNER, INTERMEDIATE, ADVANCED), `bio text`.

**`exercises`**
`id`, `name varchar(120)` NOT NULL, `muscle_group varchar(40)` NOT NULL, `equipment varchar(40)`, `is_public boolean` DEFAULT true, `created_by` FK→users ON DELETE SET NULL, `created_at`. UNIQUE `(name, created_by)`.

**`workout_plans`**
`id`, `owner_id` FK→users NOT NULL, `trainer_id` FK→users NULL, `title varchar(120)` NOT NULL, `description text`, `days_per_week smallint` CHECK 1–7, `is_template boolean` DEFAULT false, `created_at`.

**`plan_exercises`** — join table with payload
`id`, `plan_id` FK→workout_plans ON DELETE CASCADE, `exercise_id` FK→exercises, `day_index smallint` CHECK 1–7, `target_sets smallint`, `target_reps smallint`, `order_index smallint`. UNIQUE `(plan_id, day_index, order_index)`.

**`workouts`** — a logged session
`id`, `user_id` FK→users ON DELETE CASCADE, `plan_id` FK→workout_plans NULL ON DELETE SET NULL, `performed_at timestamptz` NOT NULL, `duration_min smallint`, `notes text`, `created_at`. Index on `(user_id, performed_at DESC)`.

**`workout_sets`**
`id`, `workout_id` FK→workouts ON DELETE CASCADE, `exercise_id` FK→exercises, `set_number smallint` NOT NULL, `reps smallint` NOT NULL CHECK > 0, `weight_kg numeric(6,2)` CHECK >= 0, `rpe numeric(3,1)` CHECK 1–10 NULL. UNIQUE `(workout_id, exercise_id, set_number)`.

**`goals`**
`id`, `user_id` FK→users ON DELETE CASCADE, `exercise_id` FK→exercises NULL, `goal_type varchar(24)` CHECK in (MAX_WEIGHT, TOTAL_VOLUME, SESSION_COUNT, BODY_WEIGHT), `target_value numeric(8,2)` NOT NULL, `unit varchar(12)` NOT NULL, `deadline date`, `status varchar(12)` DEFAULT `'ACTIVE'` CHECK in (ACTIVE, ACHIEVED, ABANDONED), `created_at`.

---

## 5. Migrations

Requirement: at least 3 *different types*. Six files covering 7 distinct operation types.

```
migrations/
  0001_create_core_tables.sql        CREATE TABLE (users, exercises)
  0002_create_workout_tables.sql     CREATE TABLE + FOREIGN KEY (plans, plan_exercises, workouts, sets, goals)
  0003_add_profile_columns.sql       CREATE TABLE profiles; ALTER TABLE ... ADD COLUMN (bio, experience_level)
  0004_alter_column_types.sql        ALTER COLUMN TYPE (weight_kg smallint→numeric(5,2));
                                     ALTER COLUMN SET NOT NULL; ALTER COLUMN SET DEFAULT
  0005_add_constraints_indexes.sql   ADD CONSTRAINT (CHECK + UNIQUE); CREATE INDEX
  0006_drop_legacy_add_fk.sql        DROP COLUMN (users.legacy_username);
                                     ADD CONSTRAINT ... FOREIGN KEY (workout_plans.trainer_id)
```

For 0004 and 0006 to be honest migrations rather than theatre, **0001 must actually create `users.legacy_username`** and **0003 must create `profiles.weight_kg` as `smallint`**. The agent must not "optimise" these away — the migration history is itself a graded deliverable.

**Runner:** `scripts/migrate.mjs` — creates `_migrations(id serial, filename text unique, applied_at timestamptz default now())`, reads `migrations/*.sql` in lexical order, skips already-applied, wraps each file in a transaction. Connects via `DIRECT_URL`. Scripts: `npm run db:migrate`, `db:seed`, `db:reset`.

**Seed:** `scripts/seed.mjs` — 1 admin, 2 trainers, 5 members, ~25 exercises, 3 plans, ~40 workouts with sets spread over 90 days (so the charts have something to show), ~8 goals. Seed password is `Password123!` for every account, documented in the README.

---

## 6. API surface

All responses JSON, including errors:

```jsonc
// success
{ "data": <payload>, "meta": { "page": 1, "pageSize": 20, "total": 57 } }  // meta only on collections
// error
{ "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [ … ] } }
```

Status codes: 200, 201, 204, 400, 401, 403, 404, 409, 422, 500. A thrown error never leaks a stack trace to the client.

### 6.1 Controllers

The requirement says *"kreirati API rute i **kontrolere**"*. That wording comes from Laravel/Django, where routes and controllers are separate files. In the Next.js App Router the `route.ts` handler *is* the controller, so a marker looking for a controller layer will not find one.

Fix it structurally, at no cost: business logic lives in `lib/controllers/*.ts`, and every `route.ts` is a thin wrapper.

```
lib/controllers/
  auth.controller.ts        register, login, logout, me
  exercises.controller.ts   list, get, create, update, remove
  workouts.controller.ts    list, get, create, update, remove
  sets.controller.ts        listForWorkout, create, update, remove
  plans.controller.ts       list, get, create, update, remove, assign
  goals.controller.ts       list, create, update, remove
  stats.controller.ts       overview, progress
  admin.controller.ts       listUsers, updateUser
```

Each controller function takes already-parsed, already-authorised input and returns plain data or throws a typed `ApiError`. The route handler does four things only: read params/body, call the guard, call the controller, serialise the result. A shared `withApi()` wrapper catches `ApiError` and maps it to the JSON error envelope, so no handler contains a try/catch.

This also makes the documentation's "isečak iz koda i pojašnjenje" section much easier to write — a controller function is a self-contained snippet, a route handler plus inline logic is not.

### 6.2 Routes

Requirement: at least 3 *types* of route. Five distinct shapes:

| Type | Example |
|---|---|
| **1. Collection** | `GET`/`POST` `/api/workouts` |
| **2. Resource** (dynamic segment) | `GET`/`PATCH`/`DELETE` `/api/workouts/[id]` |
| **3. Nested sub-resource** | `/api/workouts/[id]/sets`, `/api/workouts/[id]/sets/[setId]` |
| **4. Action / non-REST verb** | `POST /api/auth/login`, `/logout`, `/register` |
| **5. Aggregate / query** | `GET /api/stats/progress?exerciseId=&from=&to=` |

```
POST   /api/auth/register            public
POST   /api/auth/login               public
POST   /api/auth/logout              auth
GET    /api/auth/me                  auth

GET    /api/exercises                auth   ?search=&muscleGroup=&page=
POST   /api/exercises                TRAINER, ADMIN
GET    /api/exercises/[id]           auth
PATCH  /api/exercises/[id]           TRAINER(own), ADMIN
DELETE /api/exercises/[id]           ADMIN

GET    /api/workouts                 auth   (own; TRAINER may pass ?userId= for assigned members)
POST   /api/workouts                 auth
GET    /api/workouts/[id]            auth   (owner, assigned trainer, or admin)
PATCH  /api/workouts/[id]            owner, ADMIN
DELETE /api/workouts/[id]            owner, ADMIN

GET    /api/workouts/[id]/sets       auth
POST   /api/workouts/[id]/sets       owner
PATCH  /api/workouts/[id]/sets/[setId]   owner
DELETE /api/workouts/[id]/sets/[setId]   owner

GET    /api/plans                    auth
POST   /api/plans                    TRAINER, ADMIN
GET    /api/plans/[id]               auth
PATCH  /api/plans/[id]               TRAINER(own), ADMIN
DELETE /api/plans/[id]               TRAINER(own), ADMIN
POST   /api/plans/[id]/assign        TRAINER, ADMIN   body: { userId }

GET    /api/goals                    auth
POST   /api/goals                    auth
PATCH  /api/goals/[id]               owner
DELETE /api/goals/[id]               owner

GET    /api/stats/overview           auth
GET    /api/stats/progress           auth

GET    /api/admin/users              ADMIN  ?role=&active=
PATCH  /api/admin/users/[id]         ADMIN  body: { role?, isActive? }
```

Every `POST`/`PATCH`/`DELETE` requires authentication, without exception — this is the "restricted routes" requirement.

---

## 7. Auth implementation

- `POST /api/auth/register` → zod-validate, check email uniqueness (409 on conflict), `bcryptjs.hash(password, 10)`, insert with role `MEMBER`, issue session.
- Session = JWT signed HS256 with `jose`, payload `{ sub, email, role }`, `exp` 7 days, cookie `gt_session`: `httpOnly`, `secure` in production, `sameSite: 'lax'`, `path: '/'`.
- `POST /api/auth/logout` clears the cookie, returns 204.
- `middleware.ts` guards `/dashboard`, `/workouts`, `/goals`, `/plans`, `/profile`, `/trainer`, `/admin` — redirects to `/login?next=…` when the token is missing or invalid, 403s `/admin` for non-admins.
- **Runtime constraint:** middleware runs on the Edge runtime. `jose` works there; `bcryptjs` does **not**. Hashing and comparison happen only inside route handlers, which must declare `export const runtime = 'nodejs'`. Getting this wrong produces a Vercel deploy failure that works fine locally.
- `lib/auth/guard.ts` exports `getSession(req)`, `requireAuth(req)`, `requireRole(req, roles[])`. Handlers call the guard before touching the body.

---

## 8. Frontend

### 8.1 Routes (requirement: ≥3 pages; we have 12)

| Route | Access | Content |
|---|---|---|
| `/` | public | landing, feature summary, CTA |
| `/login` | public | login form |
| `/register` | public | registration form |
| `/dashboard` | auth | stat cards, 7-day volume chart, active goals, recent workouts |
| `/workouts` | auth | paginated list, filter by date range and plan |
| `/workouts/new` | auth | create session + log sets, with rest timer |
| `/workouts/[id]` | auth | detail, edit sets inline, delete session |
| `/exercises` | auth | searchable catalog with muscle-group filter |
| `/goals` | auth | goal cards with computed progress bars |
| `/plans` | auth | read-only list + detail; create/edit form for TRAINER+ only |
| `/trainer` | TRAINER+ | assigned members, their recent sessions |
| `/admin/users` | ADMIN | user table, role select, activate/deactivate |

### 8.2 Reusable components (requirement: ≥3; we have 6)

`components/ui/`

1. **`Button`** — `variant` (primary/secondary/ghost/danger), `size`, `loading`, `icon`, `onClick`.
2. **`Input`** — typed `text|email|password|number|date`, label, `error`, `onChange`.
3. **`Card`** — header/body/footer slots.
4. **`Modal`** — portal-based, focus trap, Esc-to-close, confirm/cancel.
5. **`Navbar`** — role-aware links, active-route highlight, logout.
6. **`Badge`** — status pills (goal status, user role, muscle group).

Each must be used in at least two different places. The documentation shows one code snippet per component with a short explanation.

### 8.3 Three custom TS/TSX features

Deliberately not generic CRUD, and not examples from the course script:

1. **`useRestTimer`** (`hooks/useRestTimer.ts`) — countdown between sets, on `useState` + `useRef` + `useEffect` with cleanup. Auto-starts when a set is logged; pause/resume/skip; Web Audio beep at zero. Stores the **target timestamp**, not a decrementing counter — the naive `setInterval` version drifts, and it is the first thing an agent will write.
2. **Estimated 1RM trend** (`lib/analytics/oneRepMax.ts`) — Epley `1RM = w × (1 + reps/30)` computed over set history per exercise, feeding a `recharts` line chart on `/dashboard`. Charts photograph well for the documentation, which is why this one stays.
3. **Debounced client-side exercise search** (`hooks/useDebouncedFilter.ts`) — 250 ms debounce, `useMemo`-ed multi-criteria filter (name + muscle group + equipment), active query mirrored into the URL query string so a filtered view is shareable.

**Cut for MVP:** optimistic set logging and the progressive-overload target suggestion. Both were marked bonus, neither maps to a graded requirement, and both add failure modes. A plain await-then-refetch on set logging is fine.

### 8.4 React hooks used

`useState`, `useEffect`, `useRef`, `useMemo`, `useContext` (an `AuthProvider` holding the current user), plus Next's `useRouter` / `usePathname` / `useSearchParams` in place of `useNavigate`. That already over-satisfies the requirement; no need to reach for `useCallback` or `useReducer` just to lengthen the list.

---

## 9. Requirement traceability

Copy into the final documentation, one row per requirement.

| # | Requirement | Where satisfied |
|---|---|---|
| G1 | ≥10 meaningful commits | §10 — 15 commits |
| G2 | Team members are collaborators with commits | §10 |
| G3 | Public repo | manual step |
| G4 | Documentation per template | §15 (Faza 1), §12 P9 (Faza 2) |
| F1 | Dynamic site in React/Next | whole app |
| F2 | ≥3 pages with different content | §8.1 — 12 routes |
| F3 | ≥3 reusable components | §8.2 — 6 components |
| F4 | CSS / Tailwind styling | Tailwind v4 |
| F5 | ≥3 features in TS/TSX, not from the script | §8.3 |
| F6 | React hooks | §8.4 |
| F7 | Routing to all parts of the site | App Router, §8.1 |
| B1 | ≥5 interrelated models | §4 — 8 tables |
| B2 | ≥3 migration types | §5 — 7 operation types |
| B3 | REST API routes + controllers | §6.1 controllers, §6.2 routes |
| B4 | JSON responses including errors | §6 envelope |
| B5 | ≥3 types of API route | §6 — 5 types |
| B6 | ≥3 user types | §3 |
| B7 | login / logout / register | §7 |
| B8 | Restricted routes for authenticated users | middleware + `requireRole`, §7 |

---

## 10. Git strategy

Identity is already configured per-repo:

```bash
git config user.name  "KrstaBankovic"
git config user.email "krstab0@gmail.com"
```

Everything commits under that account. Verify with `git config user.email` before the first commit, and check `git log --format='%an <%ae>'` after phase 1 — a single commit that slipped through under the wrong identity is easy to miss and annoying to rewrite later.

> If the project has a second team member listed in the template's table, requirement G2 still wants commits from them. Committing everything under one account and listing two names is the gap a marker is most likely to notice, because it is one `git log` away. Worth a decision now rather than at submission.

15 commits, in build order. The agent commits **at each phase boundary**, not at the end.

```
01  chore: scaffold next.js app with typescript and tailwind
02  chore: add supabase postgres client, env config and npm scripts
03  feat(db): create core tables migration and migration runner
04  feat(db): add workout, plan, set and goal tables
05  feat(db): add profiles table and profile columns
06  feat(db): alter column types and add constraints, indexes, foreign key
07  feat(db): add seed script with demo users and 90 days of workouts
08  feat(auth): register, login, logout and session middleware
09  feat(ui): reusable button, input, card, modal, navbar and badge
10  feat(exercises): catalog api and debounced search page
11  feat(workouts): crud api, nested sets routes and logging page
12  feat(workouts): rest timer hook and set logging ux
13  feat(goals): goals crud, progress calculation and dashboard charts
14  feat(admin): trainer view, admin user management and role guards
15  docs: readme, api reference and screen documentation
```

---

## 11. Instrumentation

### 11.1 What is measured

| Metric | Claude Code | Gemini CLI |
|---|---|---|
| Input / output / cache tokens | ✓ per turn, from the session transcript | ✗ |
| Wall-clock per phase | ✓ via hooks | ~ manual (note start/end per phase) |
| Turn count | ✓ | ~ manual tally |

Gemini CLI on the free tier does not export per-session token usage, so the token half of the comparison is Claude-only. Say this in one sentence in the write-up and move on — the wall-clock and turn-count comparison still holds, and pretending otherwise is worse than the gap. Do keep a manual per-phase stopwatch for both so at least one metric is symmetric.

`/cost` inside Claude Code is not meaningful on Pro/Max subscriptions — it targets API billing. Token *counts* are still written to the session transcript regardless of plan, which is why the hooks read the transcript rather than shelling out to `/cost`.

### 11.2 Hooks

`.claude/settings.json`:

```jsonc
{
  "attribution": { "commit": "", "pr": "" },
  "hooks": {
    "SessionStart": [
      { "hooks": [ { "type": "command", "command": "node",
                     "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/session-start.mjs"] } ] }
    ],
    "Stop": [
      { "hooks": [ { "type": "command", "command": "node",
                     "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/usage-log.mjs"] } ] }
    ],
    "PreToolUse": [
      { "matcher": "Bash",
        "hooks": [ { "type": "command", "if": "Bash(git *)", "command": "node",
                     "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/block-attribution.mjs"] } ] }
    ]
  }
}
```

Hook input arrives as JSON on stdin. `usage-log.mjs` reads `transcript_path` from it, walks the JSONL, sums `message.usage.{input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens}` across assistant messages, and appends one row per turn to `metrics/usage.jsonl` with `session_id`, `prompt_id`, timestamp and the current `git rev-parse --short HEAD`. Tagging by SHA is what lets cost be attributed back to a phase.

`scripts/usage-report.mjs` aggregates into `metrics/REPORT.md`: totals, per-phase breakdown, turns, wall-clock, tokens per commit.

### 11.3 Blocking Claude attribution

Three layers, because no single one is reliable.

**Layer 1 — settings.** `"attribution": { "commit": "", "pr": "" }` (above). Replaces the deprecated `includeCoAuthoredBy` and takes precedence over it. Suppresses the `Co-Authored-By: Claude` trailer and the `Generated with Claude Code` line at CLI level.

**Layer 2 — `CLAUDE.md` rule.** The setting does not stop the model hand-writing the trailer inside a heredoc commit message:

```
## Git
Never add "Generated with Claude Code", "Co-Authored-By: Claude", a Claude-Session
trailer, or any other AI attribution to commit messages, PR descriptions, or code
comments. Commit messages contain only the conventional-commit subject and body.
```

**Layer 3 — `commit-msg` git hook.** The only layer that cannot be talked around, because it operates on the finished message file:

```bash
#!/usr/bin/env bash
# .githooks/commit-msg
sed -i -E '/^(🤖 )?Generated with \[?Claude Code\]?/d; /^Co-[Aa]uthored-[Bb]y: Claude/d; /^Claude-Session:/d' "$1"
```

```bash
git config core.hooksPath .githooks
chmod +x .githooks/commit-msg
```

Committed to the repo, GNU `sed` syntax (correct for Git Bash on Windows).

**Layer 4 — `PreToolUse` hook.** `block-attribution.mjs` denies any `git commit` whose command string contains those markers:

```json
{ "hookSpecificOutput": { "hookEventName": "PreToolUse",
                          "permissionDecision": "deny",
                          "permissionDecisionReason": "AI attribution in commit message" } }
```

Layer 3 alone is sufficient. The others mean the message is never written wrong in the first place, which keeps the transcript clean too.

Verify at the end: `git log --all --format='%B' | grep -i -E 'claude|co-authored|generated with'` must return nothing.

---

## 12. Build phases

One prompt per phase, each ending in a commit. The agent runs `npm run build` before every commit and does not commit a failing build.

| Phase | Deliverable | Commits |
|---|---|---|
| **P-1** Faza 1 docs | §15 — design documentation and diagrams, produced **before** any code | (separate, see §15) |
| **P0** Scaffold | Next.js + TS strict + Tailwind, folder structure, `.env.example`, postgres.js client, `withApi()` wrapper, npm scripts | 01–02 |
| **P1** Schema | 6 migration files, runner, seed script, `npm run db:reset` works against Supabase | 03–07 |
| **P2** Auth | register/login/logout/me, JWT cookie, middleware, guards, login + register pages | 08 |
| **P3** UI kit | 6 reusable components, `AuthProvider`, `Navbar`, layout, landing page | 09 |
| **P4** Exercises | catalog API, `useDebouncedFilter`, `/exercises` | 10 |
| **P5** Workouts | workouts + nested sets API, `/workouts`, `/workouts/new`, `/workouts/[id]` | 11 |
| **P6** Rest timer | `useRestTimer` wired into `/workouts/new` and `/workouts/[id]` | 12 |
| **P7** Goals + stats | goals CRUD, 1RM trend, `/api/stats/*`, dashboard charts | 13 |
| **P8** Roles | `/plans`, `/trainer`, `/admin/users`, role guards end to end | 14 |
| **P9** Docs | README, API reference, per-screen documentation, `metrics/REPORT.md` — see §16 | 15 |

Hand off one phase at a time. A single mega-prompt produces a worse result and destroys the per-phase cost data, which is half the point.

---

## 13. Definition of done

- [ ] `npm run build` clean, zero TypeScript errors, `strict: true`
- [ ] `npm run db:reset` rebuilds the schema from migrations and seeds successfully
- [ ] Deployed on Vercel against the Supabase transaction pooler, seeded, demo credentials in the README
- [ ] All three roles verified manually: a MEMBER cannot reach `/admin/users` or `PATCH` another user's workout, and gets 403 **JSON**, not an HTML error page
- [ ] Every error path returns JSON, never a stack trace
- [ ] ≥10 commits, build green at every commit
- [ ] No AI attribution anywhere in the history (grep from §11.3 returns nothing)
- [ ] `metrics/REPORT.md` generated
- [ ] Repo public, link pasted into the documentation header table
- [ ] Faza 1 documentation complete (§15)
- [ ] Faza 2 documentation complete (§16) — one screenshot and description per screen, five code snippets explained

---

## 14. Resolved decisions

| Question | Decision |
|---|---|
| Git identity | All commits as `KrstaBankovic <krstab0@gmail.com>`; already configured per-repo |
| Database | Supabase standalone account, plain Postgres, transaction pooler on 6543 with `prepare: false` |
| Gemini token metrics | Not available on the free tier — mentioned in passing, comparison runs on wall-clock and turn count |
| Plan-phase token cost | Out of scope, not measured |
| Elab org link | Ignored |
| Documentation template | FON Faza 1 template, see §15 |
| Controllers | Separate `lib/controllers/` layer, route handlers are thin wrappers (§6.1) |
| MVP trims | No `/profile` page, no password change, no optimistic UI, no overload suggestion |
| Scope stance | Class MVP, not a product. Where a requirement is met, stop — do not harden past it |

---

## 15. Faza 1 — design documentation

A separate graded deliverable, written **before** the code and filled into the supplied FON template (`Faza_1_TEMPLATE.docx`). Language: **Serbian (latinica)**, matching the template. Working files live in `docs/faza-1/`; the final artefact is a `.docx` built from the template.

### 15.1 Template section map

| Template section | Source | Notes |
|---|---|---|
| Header table (Rbr / Ime / Prezime / Broj indeksa, Mentor, GitHub link) | manual | fill by hand; GitHub link must be the public repo URL |
| 1. Korisnički zahtev → Verbalni opis | new prose | problem, motivation, goals, target group, feature summary |
| 1. Funkcionalni zahtevi | §6, §8 | numbered FZ-01…, each one sentence, traceable to an endpoint or page |
| 1. Nefunkcionalni zahtevi | new prose | six categories, see 15.3 |
| 1. Uloge i permisije | §3 | table per role: allowed functions / restrictions / data access rights |
| 2. Slučajevi korišćenja | new | use-case diagram per actor + 6 detailed descriptions, see 15.2 |
| 2. Arhitektura aplikacije | §2, §7 | component diagram + data-flow prose |
| 2. Dijagrami sekvenci | new | 4 sequences, see 15.4 |
| 2. Model podataka — PMOV | §4 | ER diagram with attributes, cardinalities, constraints |
| 3. Predlog tehnologija | §2 | frontend / backend / baza / integracije / DevOps, with *why* for each |

### 15.2 Use cases to document in full

Diagram per actor (MEMBER, TRAINER, ADMIN), then six full descriptions — each with *ime, akteri, kratak opis, preduslovi, glavni tok, alternativni tokovi, postuslovi*:

1. **UC-01 Registracija korisnika** — alt: email already taken (409)
2. **UC-02 Prijava na sistem** — alt: wrong password, deactivated account
3. **UC-03 Evidentiranje treninga sa serijama** — alt: validation failure, optimistic rollback on network error
4. **UC-04 Kreiranje i praćenje cilja** — alt: goal auto-transitions to ACHIEVED
5. **UC-05 Trener dodeljuje plan članu** — alt: member not assigned to this trainer (403)
6. **UC-06 Administrator menja ulogu korisnika** — alt: admin tries to demote their own account

### 15.3 Non-functional requirements — what to actually write

The template lists categories; write two or three concrete, checkable sentences per category, not slogans:

- **Performanse** — API p95 under 500 ms for reads on the seeded dataset; list endpoints paginated at 20 with server-side filtering; dashboard aggregates computed in SQL, not in the client.
- **Bezbednost** — bcrypt cost 10; JWT HS256 in an httpOnly/Secure/SameSite=Lax cookie, 7-day expiry; authorization checked server-side in every handler, never only in the UI; all input zod-validated; parameterised queries only; TLS enforced to the database.
- **Pouzdanost i dostupnost** — stateless serverless functions; Supabase managed backups; every migration transactional and re-runnable.
- **Upotrebljivost** — responsive from 360 px; keyboard-accessible forms with inline validation errors; UI language Serbian (or English — pick one and be consistent).
- **Održavanje i skalabilnost** — TypeScript strict; migrations version-controlled and forward-only; connection pooling via Supavisor so function concurrency does not exhaust the DB.
- **Portabilnost** — any modern browser; no vendor lock-in beyond standard Postgres, so the app is redeployable anywhere Node runs.

### 15.4 Diagrams

`docs/faza-1/diagrams/*.puml`, rendered to PNG and embedded in the docx.

| Diagram | Type |
|---|---|
| `usecase-member.puml`, `usecase-trainer.puml`, `usecase-admin.puml` | UML use case |
| `components.puml` | UML component — browser (Next.js client) ↔ Next.js server (middleware, route handlers, guards, analytics lib) ↔ Supabase Postgres via Supavisor pooler; Vercel edge/CDN in front |
| `seq-login.puml` | sequence — credentials → handler → bcrypt compare → JWT sign → Set-Cookie → redirect |
| `seq-log-set.puml` | sequence — optimistic UI update → POST sets → validation → insert → rollback path on failure |
| `seq-assign-plan.puml` | sequence — trainer assigns plan, role guard check, insert |
| `seq-admin-role.puml` | sequence — admin changes role, self-demotion guard |
| `pmov.puml` | ER / class diagram of §4, with attributes, cardinalities and FK constraints |

**Tooling:** PlantUML, because it has proper UML use-case and component notation that a marker will recognise. Rendering needs Java + Graphviz. If that turns into a fight on Windows, Mermaid (`@mermaid-js/mermaid-cli`, npm, no Java) covers `sequenceDiagram` and `erDiagram` cleanly but has **no use-case notation** — in that case draw the use-case diagrams by hand in draw.io and keep Mermaid for the rest. Decide before starting so all diagrams come out in one visual style.

### 15.5 Deliverable

`docs/faza-1/Faza1_GymTracker.docx` — the supplied template with every section filled and every diagram embedded as an image, plus the `.puml` sources committed alongside so the diagrams are regenerable.

---

## 16. Faza 2 — application documentation

The second assignment says *"dopuniti dokumentaciju za Fazu 1"*: the Faza 1 document gains two new chapters describing the built application. This is real work, not a footnote, and P9 is where it happens.

### 16.1 Screen documentation

**One screenshot and one description per screen — 12 screens.** Take them against the seeded database so nothing looks empty. For each: what the screen is for, who can reach it, what the user can do there, and which API routes it calls.

Screenshot discipline, because re-taking 12 screenshots is miserable:

- Same browser, same window size (1440×900), light mode, throughout.
- Log in as the *right* role for the screen — `/admin/users` screenshotted as the admin, `/trainer` as a trainer.
- Include at least one screenshot of a validation error and one of a 403, to evidence B4 and B8.
- Store in `docs/faza-2/screens/` as `01-landing.png`, `02-login.png`, … matching the §8.1 route order.

### 16.2 Code snippets

**Five snippets with explanation** (*"isečak iz koda i pojašnjenje"*), chosen so that between them they evidence the harder requirements:

| Snippet | Evidences |
|---|---|
| `lib/auth/guard.ts` — `requireRole()` | B6, B8 — authorisation, three user types |
| `lib/controllers/workouts.controller.ts` — one function | B3 — controllers |
| `migrations/0004_alter_column_types.sql` | B2 — migration types |
| `hooks/useRestTimer.ts` | F5, F6 — custom TS feature and hooks |
| `components/ui/Modal.tsx` + two call sites | F3 — reusable components |

Each snippet gets a short paragraph: what it does, why it is written that way, and which requirement it satisfies. Do not paste whole files — 15 to 30 lines each.

### 16.3 Deliverable

`docs/faza-2/Faza2_GymTracker.docx` — the Faza 1 document extended with the two chapters above. Keep the Faza 1 chapters intact; the assignment asks for a supplement, not a replacement.
