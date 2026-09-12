# GymTracker API

Every endpoint returns JSON, including every error. Nothing returns an HTML error page
and no error leaks a stack trace.

## Response envelope

Success:

```jsonc
{ "data": <payload> }

// collections that paginate also carry meta
{ "data": [ … ], "meta": { "page": 1, "pageSize": 20, "total": 57 } }
```

Error:

```jsonc
{ "error": { "code": "VALIDATION_ERROR", "message": "Request payload is invalid.",
             "details": [ … ] } }
```

`details` is present only on `VALIDATION_ERROR`, where it carries the zod issue list.

| Code | Status | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400, 422 | 400 for a malformed path id, 422 for a body that fails validation |
| `UNAUTHENTICATED` | 401 | no session cookie, or it is invalid or expired |
| `FORBIDDEN` | 403 | authenticated, but the role or ownership check failed |
| `NOT_FOUND` | 404 | no such record, or one the caller may not see |
| `CONFLICT` | 409 | uniqueness violation, or a delete blocked by a foreign key |
| `INTERNAL_ERROR` | 500 | unexpected failure; the message is generic by design |

## Authentication

Sessions are a JWT (HS256, 7-day expiry, payload `{ sub, email, role }`) in the
`gt_session` cookie: `httpOnly`, `sameSite=lax`, `path=/`, `secure` in production.
`POST /api/auth/login` and `/register` set it; `/logout` clears it.

Authorisation is checked server-side in every handler through
`requireAuth()` / `requireRole()`, never only in the UI. Page routes are additionally
guarded by `middleware.ts`.

The **Access** column below means: `public` — no session; `auth` — any signed-in user;
a role list — that role only; `owner` — the record's owner (an `ADMIN` may also act).

## Route types

Five distinct shapes are in use:

| Type | Example |
|---|---|
| Collection | `GET`/`POST` `/api/workouts` |
| Resource (dynamic segment) | `GET`/`PATCH`/`DELETE` `/api/workouts/{id}` |
| Nested sub-resource | `/api/workouts/{id}/sets`, `/api/workouts/{id}/sets/{setId}` |
| Action (non-REST verb) | `POST /api/auth/login`, `POST /api/plans/{id}/assign` |
| Aggregate / query | `GET /api/stats/progress?exerciseId=&from=&to=` |

---

## Auth

### `POST /api/auth/register` — public

```jsonc
// request
{ "email": "someone@example.com", "password": "Password123!", "fullName": "Some One" }
// 201, sets gt_session
{ "data": { "id": 9, "email": "someone@example.com", "fullName": "Some One",
            "role": "MEMBER", "isActive": true } }
```

`409 CONFLICT` if the email is taken. New accounts are always `MEMBER`; a profile row is
created alongside the user. Password: 8–72 characters, hashed with bcrypt cost 10.

### `POST /api/auth/login` — public

```jsonc
// request
{ "email": "member1@gymtracker.local", "password": "Password123!" }
// 200, sets gt_session — same shape as register
```

`401 UNAUTHENTICATED` for both an unknown email and a wrong password, so the endpoint
cannot be used to enumerate accounts. `403 FORBIDDEN` if the account is deactivated.

### `POST /api/auth/logout` — auth

`204`, clears the cookie. No body.

### `GET /api/auth/me` — auth

`200` with the current user, same shape as register. `401` without a valid session.

---

## Exercises

### `GET /api/exercises` — auth

Query: `search` (case-insensitive substring of the name), `muscleGroup` (exact),
`page` (default 1). Page size is 20.

```jsonc
{ "data": [ { "id": 1, "name": "Barbell Curl", "muscleGroup": "Arms",
              "equipment": "Barbell", "isPublic": true,
              "createdBy": 2, "createdByName": "Marko Ilic" } ],
  "meta": { "page": 1, "pageSize": 20, "total": 26 } }
```

### `POST /api/exercises` — `TRAINER`, `ADMIN`

```jsonc
// request; equipment and isPublic optional
{ "name": "Zercher Squat", "muscleGroup": "Legs", "equipment": "Barbell", "isPublic": true }
// 201 with the created exercise
```

`409 CONFLICT` if you already created an exercise with that name — the
`(name, created_by)` unique constraint.

### `GET /api/exercises/{id}` — auth

`200` with the exercise, `404` if it does not exist.

### `PATCH /api/exercises/{id}` — `TRAINER` (own), `ADMIN`

Body: any subset of the create fields. A trainer editing an exercise they did not create
gets `403`.

### `DELETE /api/exercises/{id}` — `ADMIN`

`204`. Returns `409 CONFLICT` when the exercise is still referenced by logged sets or plan
rows — the set history is never destroyed to satisfy a delete.

---

## Workouts

### `GET /api/workouts` — auth

Query: `userId`, `planId`, `from` (`YYYY-MM-DD`), `to` (inclusive), `page`. Page size 20.
Defaults to the caller's own sessions. `userId` is permitted for an `ADMIN`, or a
`TRAINER` who owns a plan belonging to that member; anyone else gets `403`.

```jsonc
{ "data": [ { "id": 12, "userId": 4, "userName": "Nikola Jovanovic",
              "planId": 2, "planTitle": "Beginner Strength",
              "performedAt": "2026-09-05T18:12:00.000Z", "durationMin": 63,
              "notes": "Push day", "setCount": 9, "totalVolumeKg": 7010 } ],
  "meta": { "page": 1, "pageSize": 20, "total": 18 } }
```

`setCount` and `totalVolumeKg` are aggregated in SQL.

### `POST /api/workouts` — auth

```jsonc
// request; only performedAt is required
{ "performedAt": "2026-09-12T10:00:00.000Z", "planId": null,
  "durationMin": 50, "notes": "Push day" }
// 201 with the created workout
```

Always created for the calling user. A `planId` must be the caller's own plan or a
template, else `404`.

### `GET /api/workouts/{id}` — auth (owner, that member's trainer, or `ADMIN`)

`200` with the workout, `403` for anyone else, `404` if missing.

### `PATCH /api/workouts/{id}` — owner, `ADMIN`

Body: any subset of the create fields. `403` for a different member.

### `DELETE /api/workouts/{id}` — owner, `ADMIN`

`204`. The session's sets are removed with it (`ON DELETE CASCADE`).

---

## Sets (nested under a workout)

### `GET /api/workouts/{id}/sets` — auth (same visibility as the parent session)

```jsonc
{ "data": [ { "id": 101, "workoutId": 12, "exerciseId": 1,
              "exerciseName": "Bench Press", "setNumber": 1,
              "reps": 8, "weightKg": 70, "rpe": 8 } ] }
```

### `POST /api/workouts/{id}/sets` — owner

```jsonc
// request; rpe optional, weightKg defaults to 0 for bodyweight work
{ "exerciseId": 1, "setNumber": 1, "reps": 8, "weightKg": 70, "rpe": 8 }
// 201 with the created set
```

`409 CONFLICT` if that `(exercise, setNumber)` already exists in the session.
`422` for `reps < 1`, a negative weight, or an RPE outside 1–10.

### `PATCH /api/workouts/{id}/sets/{setId}` — owner

Body: any subset of the create fields. `404` if the set is not in that session.

### `DELETE /api/workouts/{id}/sets/{setId}` — owner

`204`.

---

## Plans

### `GET /api/plans` — auth

`200` with plans you own, plans you are the trainer of, and public templates; an `ADMIN`
sees all. Filtering is done in SQL so the list and the detail read agree.

```jsonc
{ "data": [ { "id": 1, "ownerId": 2, "ownerName": "Marko Ilic",
              "trainerId": 2, "trainerName": "Marko Ilic",
              "title": "Push / Pull / Legs - 3 days",
              "description": "Basic three-day split for general strength.",
              "daysPerWeek": 3, "isTemplate": true } ] }
```

### `POST /api/plans` — `TRAINER`, `ADMIN`

```jsonc
{ "title": "Beginner Strength", "description": null,
  "daysPerWeek": 3, "isTemplate": true, "ownerId": null }
// 201 with the created plan
```

`ownerId` defaults to the caller; `trainerId` is always the caller.

### `GET /api/plans/{id}` — auth (owner, trainer, template, or `ADMIN`)

Adds the day-by-day exercise list:

```jsonc
{ "data": { "id": 1, "title": "…", "exercises": [
    { "id": 1, "exerciseId": 1, "exerciseName": "Bench Press", "dayIndex": 1,
      "targetSets": 3, "targetReps": 8, "orderIndex": 1 } ] } }
```

### `PATCH /api/plans/{id}` — `TRAINER` (own), `ADMIN`

Body: any subset of the create fields. `403` for a trainer who does not own the plan.

### `DELETE /api/plans/{id}` — `TRAINER` (own), `ADMIN`

`204`. Plan rows cascade; workouts that referenced the plan keep their history with
`plan_id` set to null.

### `POST /api/plans/{id}/assign` — `TRAINER`, `ADMIN`

```jsonc
// request
{ "userId": 6 }
// 201 with the new plan owned by that member
```

Assigning **copies** the plan and its exercise rows to the member, so the template keeps
its own identity. The copy is owned by the member with the assigner as its trainer, and
`isTemplate` false. `403` if you did not create the source plan; `404` if the member does
not exist or is deactivated.

---

## Goals

### `GET /api/goals` — auth

`200` with the caller's goals, active first. `currentValue` and `progressPct` are computed
by Postgres per goal type — max weight for the exercise, total logged volume, session
count, or the profile's body weight.

```jsonc
{ "data": [ { "id": 1, "exerciseId": 1, "exerciseName": "Bench Press",
              "goalType": "MAX_WEIGHT", "targetValue": 100, "currentValue": 67.5,
              "progressPct": 68, "unit": "kg",
              "deadline": "2026-11-11", "status": "ACTIVE" } ] }
```

`goalType`: `MAX_WEIGHT`, `TOTAL_VOLUME`, `SESSION_COUNT`, `BODY_WEIGHT`.
`status`: `ACTIVE`, `ACHIEVED`, `ABANDONED`.

### `POST /api/goals` — auth

```jsonc
{ "goalType": "MAX_WEIGHT", "exerciseId": 1, "targetValue": 100,
  "unit": "kg", "deadline": "2026-11-11", "status": "ACTIVE" }
// 201 with the created goal, progress already computed
```

`422` if a `MAX_WEIGHT` goal has no `exerciseId`.

### `PATCH /api/goals/{id}` — owner

Body: any subset of `targetValue`, `unit`, `deadline`, `status`. Someone else's goal
returns `404`, not `403`, so the endpoint does not confirm that it exists.

### `DELETE /api/goals/{id}` — owner

`204`.

---

## Stats

### `GET /api/stats/overview` — auth

Every figure is aggregated by Postgres; no rows are pulled into JS to be summed.

```jsonc
{ "data": {
    "sessionCount": 18,
    "totalVolumeKg": 78480,
    "setsLast7Days": 9,
    "activeGoals": 2,
    "volumeByDay": [ { "day": "2026-09-06", "volumeKg": 0 } ],
    "loggedExercises": [ { "id": 1, "name": "Bench Press", "setCount": 18 } ] } }
```

`volumeByDay` always has exactly 7 entries, oldest first, zero-filled on rest days.
`loggedExercises` is ordered by how often the exercise appears and drives the 1RM picker.

### `GET /api/stats/progress` — auth

Query: `exerciseId` (required), `from`, `to` (`YYYY-MM-DD`).

```jsonc
{ "data": { "exerciseId": 1, "exerciseName": "Bench Press",
            "points": [ { "day": "2026-06-15", "estimated1RM": 80 },
                        { "day": "2026-08-31", "estimated1RM": 85.5 } ] } }
```

One best estimate per training day, oldest first, using Epley
(`1RM = weight × (1 + reps / 30)`). Postgres reduces the set history to the distinct
weight/rep pairings per day; the estimate is applied once in
`lib/analytics/oneRepMax.ts`, so the formula is not duplicated in SQL. The maximum is
taken over the *estimate*, because a lighter set taken for more reps can imply a higher
1RM than a heavier single.

---

## Admin

### `GET /api/admin/users` — `ADMIN`

Query: `role` (`MEMBER` | `TRAINER` | `ADMIN`), `active` (`true` | `false`).

```jsonc
{ "data": [ { "id": 1, "email": "admin@gymtracker.local", "fullName": "Ana Adamovic",
              "role": "ADMIN", "isActive": true,
              "createdAt": "2026-09-12T13:55:36.128Z", "workoutCount": 0 } ] }
```

### `PATCH /api/admin/users/{id}` — `ADMIN`

```jsonc
// request; at least one field required
{ "role": "TRAINER", "isActive": true }
// 200 with the updated user
```

`409 CONFLICT` if an admin tries to change their own role or deactivate their own
account — that would leave the system with nobody in charge. A non-admin gets
`403 FORBIDDEN` as JSON, not an HTML error page.
