import postgres from "postgres";

// The app runtime connects through the Supabase transaction pooler (port 6543).
// Transaction mode does not support prepared statements, so `prepare` must be off —
// without it queries fail intermittently in production and work fine locally.
export const sql = postgres(process.env.DATABASE_URL!, {
  prepare: false,
  ssl: "require",
});
