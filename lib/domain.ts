/**
 * Domain constants shared by server controllers and client components.
 *
 * Controllers import `lib/db.ts`, which pulls in postgres.js — a Node-only module.
 * Anything a client component needs at *runtime* (rather than as an erased type)
 * therefore lives here, where there is no database import to follow.
 */

export const ROLE_VALUES = ["MEMBER", "TRAINER", "ADMIN"] as const;
export type Role = (typeof ROLE_VALUES)[number];

export const GOAL_TYPES = ["MAX_WEIGHT", "TOTAL_VOLUME", "SESSION_COUNT", "BODY_WEIGHT"] as const;
export const GOAL_STATUSES = ["ACTIVE", "ACHIEVED", "ABANDONED"] as const;

export type GoalType = (typeof GOAL_TYPES)[number];
export type GoalStatus = (typeof GOAL_STATUSES)[number];
