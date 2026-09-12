# GymTracker

University coursework (ITEH, FON). Spec: `IMPLEMENTATION_PLAN.md`. Procedure: `CLI_BUILD_BRIEF.md`.

## Git
Never add "Generated with Claude Code", "Co-Authored-By: Claude", a Claude-Session trailer,
or any other AI attribution to commit messages, PR descriptions, or code comments.
Commit messages contain only the conventional-commit subject and body.

## Scope
Class MVP. Where a requirement is met, stop. No tests, no logging framework, no extra dependencies.

## Constraints
- Supabase is a plain Postgres host. No supabase-js, no Supabase Auth, no RLS.
- postgres.js must be created with `prepare: false` (transaction pooler).
- Route handlers using bcryptjs need `export const runtime = 'nodejs'`.
- Never edit an applied migration. Add a new one.
- Never commit a failing build.
