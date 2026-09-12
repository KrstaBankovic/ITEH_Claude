import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import postgres from "postgres";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(root, "migrations");

if (!process.env.DIRECT_URL) {
  console.error("DIRECT_URL is not set. Copy .env.example to .env.local and fill it in.");
  process.exit(1);
}

// Migrations run from a developer machine, so they use the direct connection
// (port 5432) rather than the transaction pooler the app runtime uses.
const sql = postgres(process.env.DIRECT_URL, {
  ssl: "require",
  max: 1,
  // DDL emits benign notices ("already exists, skipping"); only errors matter here.
  onnotice: () => {},
});

async function reset() {
  await sql
    .unsafe(
      `do $$
       declare r record;
       begin
         for r in select tablename from pg_tables where schemaname = 'public' loop
           execute format('drop table if exists public.%I cascade', r.tablename);
         end loop;
       end $$;`,
    )
    .simple();
  console.log("reset  dropped every table in schema public");
}

async function main() {
  if (process.argv.includes("--reset")) await reset();

  await sql
    .unsafe(
      `create table if not exists _migrations (
         id         serial primary key,
         filename   text not null unique,
         applied_at timestamptz not null default now()
       );`,
    )
    .simple();

  const applied = new Set(
    (await sql`select filename from _migrations`).map((row) => row.filename),
  );
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip   ${file}`);
      continue;
    }
    const statements = await readFile(path.join(migrationsDir, file), "utf8");
    // One transaction per file: a migration either lands whole or not at all.
    await sql.begin(async (tx) => {
      await tx.unsafe(statements).simple();
      await tx`insert into _migrations (filename) values (${file})`;
    });
    console.log(`apply  ${file}`);
    count += 1;
  }

  console.log(count === 0 ? "up to date." : `${count} migration(s) applied.`);
  await sql.end();
}

main().catch(async (err) => {
  console.error(`migration failed: ${err.message ?? err}`);
  await sql.end({ timeout: 5 });
  process.exit(1);
});
