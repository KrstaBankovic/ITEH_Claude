# CLI Build Brief — GymTracker

You are implementing this project start to finish, autonomously. `IMPLEMENTATION_PLAN.md` in the repo root is the specification and the single source of truth. This file is the operating procedure: what order to build in, when to commit, and what not to do.

Read `IMPLEMENTATION_PLAN.md` in full before writing anything.

---

## 0. Context

University coursework (ITEH, FON). A gym workout tracker, built twice — once by Claude Code, once by Gemini CLI — so the two runs can be compared. This is a class MVP, not a product.

**The scope stance matters.** Where a requirement is met, stop. Do not add tests, do not add a logging framework, do not add error-boundary infrastructure, do not refactor for extensibility. Every extra file makes the comparison noisier and costs tokens for no grade. If you find yourself thinking "this would be better if…", it wouldn't — it would be bigger.

## 1. Preconditions — verify, do not create

The human has already done the setup in `MANUAL_SETUP.md`. Before phase P0, confirm all of these and **stop and report if any is missing**:

```bash
node -v                                    # 20+
git config user.email                      # krstab0@gmail.com
git config core.hooksPath                  # .githooks
ls .githooks/commit-msg                    # exists, executable
ls .claude/settings.json                   # exists
ls .claude/hooks/                          # 3 .mjs files
ls CLAUDE.md                               # exists
test -f .env.local && echo "env ok"        # exists
```

Do not create, edit or read `.env.local`. Do not print the contents of any environment variable. If `.env.local` is missing, stop and say so — you cannot proceed without a database.

## 2. Hard rules

1. **Never commit a failing build.** `npm run build` must exit 0 before every single commit. If it fails, fix it, then commit.
2. **One commit per phase**, using the exact message from `IMPLEMENTATION_PLAN.md` §10. Do not batch phases into one commit and do not split a phase into five.
3. **No AI attribution anywhere** — not in commit messages, not in PR descriptions, not in code comments, not in the README. No `Co-Authored-By`, no `Generated with Claude Code`, no `Claude-Session` trailer. A git hook strips these, but do not write them in the first place.
4. **Do not "optimise" the migrations.** `0001` must create `users.legacy_username` and `0003` must create `profiles.weight_kg` as `smallint`, purely so that `0004` and `0006` have something real to alter and drop. The migration history is a graded artefact. Never edit an already-written migration file — add a new one.
5. **Do not add dependencies** beyond those named in the plan §2. If you believe one is genuinely required, stop and ask rather than installing it.
6. **Do not use Supabase Auth, `supabase-js`, or RLS.** Supabase is a plain Postgres host. Auth is ours, per plan §7.
7. **Do not touch** `.claude/`, `.githooks/`, `metrics/`, `scripts/usage-report.mjs`, or `IMPLEMENTATION_PLAN.md`. That is measurement and policy infrastructure; changing it corrupts the comparison.
8. **Stop and ask** rather than guessing, if: the plan contradicts itself, a migration would lose data, or a requirement cannot be met as specified. One clarifying question is cheap; an hour of wrong work is not.

## 3. Execution order

Run phases in order. Each phase: build → verify → `npm run build` → commit → move on.

### P0 — Scaffold (commits 01, 02)
Next.js 15+ App Router, TypeScript `strict: true`, Tailwind v4, ESLint. Folder structure per plan. `lib/db.ts` with postgres.js and `prepare: false` (plan §2 — transaction pooler does not support prepared statements; this is not optional). `lib/api/withApi.ts` wrapper and `ApiError` type. `.env.example` with keys and no values. npm scripts: `db:migrate`, `db:seed`, `db:reset`.

*Accept when:* `npm run dev` serves a placeholder page and `npm run build` is clean.

### P1 — Schema (commits 03–07)
Six migration files per plan §5, exactly as specified. `scripts/migrate.mjs` (transactional, tracks applied files in `_migrations`, connects via `DIRECT_URL`). `scripts/seed.mjs` per plan §5.

*Accept when:* `npm run db:reset` runs clean twice in a row, and `select count(*) from workout_sets` returns a few hundred rows.

### P2 — Auth (commit 08)
`lib/controllers/auth.controller.ts`, four routes, `lib/auth/guard.ts`, `middleware.ts`. Route handlers that hash or compare passwords must declare `export const runtime = 'nodejs'` — `bcryptjs` does not run on the Edge runtime, and this fails only on deploy, never locally. `/login` and `/register` pages.

*Accept when:* register → login → `GET /api/auth/me` returns the user; a bad password returns 401 JSON; hitting `/dashboard` logged out redirects to `/login`.

### P3 — UI kit (commit 09)
Six components per plan §8.2, `AuthProvider`, `Navbar`, root layout, landing page. Each component used in at least two places by the end of the build.

### P4 — Exercises (commit 10)
`exercises.controller.ts`, five routes, `useDebouncedFilter`, `/exercises`.

### P5 — Workouts (commit 11)
`workouts.controller.ts` and `sets.controller.ts`, collection + resource + nested-resource routes, `/workouts`, `/workouts/new`, `/workouts/[id]`.

### P6 — Rest timer (commit 12)
`useRestTimer` per plan §8.3. Store the **target timestamp** and derive remaining time from `Date.now()`; a decrementing `setInterval` counter drifts and is wrong. Wire into the set-logging flow.

### P7 — Goals and stats (commit 13)
`goals.controller.ts`, `stats.controller.ts`, `lib/analytics/oneRepMax.ts`, `/goals`, and the `/dashboard` charts. Aggregates computed in SQL, not by pulling rows into JS.

### P8 — Roles (commit 14)
`plans.controller.ts`, `admin.controller.ts`, `/plans`, `/trainer`, `/admin/users`. Role guards enforced server-side in every handler.

*Accept when:* logged in as a MEMBER, `/admin/users` is blocked and `PATCH /api/admin/users/1` returns 403 **JSON**, not an HTML error page.

### P9 — Docs (commit 15)
`README.md`: what it is, stack, local setup, `db:reset`, seeded demo credentials for all three roles, deployed URL. `docs/API.md`: every route, method, auth requirement, request and response shape. Do **not** write the Faza 1 or Faza 2 Word documents — those are human deliverables (plan §15, §16); your job is the README and the API reference.

## 4. Per-phase self-check

Before each commit:

```bash
npm run build                                                  # must exit 0
npx tsc --noEmit                                               # zero errors
git status --porcelain                                         # nothing unintended staged
git log -1 --format='%an <%ae>'                                # KrstaBankovic <krstab0@gmail.com>
```

## 5. Final verification

```bash
npm run build
npm run db:reset
git log --oneline | wc -l                                      # >= 15
git log --all --format='%B' | grep -i -E 'claude|co-authored|generated with'   # must return nothing
git log --format='%an <%ae>' | sort -u                         # one identity only
```

Then report: what was built, anything that deviated from the plan and why, and anything a human still has to do.

## 6. When something goes wrong

- **Build breaks:** fix it in the current phase. Do not commit and fix in the next one.
- **A migration was wrong:** write a new migration that corrects it. Never edit an applied one.
- **The plan is ambiguous:** pick the simpler reading, implement it, and note the choice in your final report.
- **The plan is contradictory, or a requirement is unmeetable:** stop and ask. Do not silently redesign around it.
