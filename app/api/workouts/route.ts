import { json, parse, readJson, withApi } from "@/lib/api/withApi";
import { requireAuth } from "@/lib/auth/guard";
import { create, createSchema, list, listQuerySchema } from "@/lib/controllers/workouts.controller";

export const runtime = "nodejs";

export const GET = withApi(async (req) => {
  const session = await requireAuth(req);
  const query = parse(listQuerySchema, Object.fromEntries(req.nextUrl.searchParams.entries()));
  const { data, meta } = await list(session, query);
  return json(data, { meta });
});

export const POST = withApi(async (req) => {
  const session = await requireAuth(req);
  const input = parse(createSchema, await readJson(req));
  return json(await create(session, input), { status: 201 });
});
