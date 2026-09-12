import { json, parse, readJson, withApi } from "@/lib/api/withApi";
import { requireAuth, requireRole } from "@/lib/auth/guard";
import { create, createSchema, list, listQuerySchema } from "@/lib/controllers/exercises.controller";

export const runtime = "nodejs";

export const GET = withApi(async (req) => {
  await requireAuth(req);
  const query = parse(
    listQuerySchema,
    Object.fromEntries(req.nextUrl.searchParams.entries()),
  );
  const { data, meta } = await list(query);
  return json(data, { meta });
});

export const POST = withApi(async (req) => {
  const session = await requireRole(req, ["TRAINER", "ADMIN"]);
  const input = parse(createSchema, await readJson(req));
  return json(await create(session, input), { status: 201 });
});
