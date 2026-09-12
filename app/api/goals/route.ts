import { json, parse, readJson, withApi } from "@/lib/api/withApi";
import { requireAuth } from "@/lib/auth/guard";
import { create, createSchema, list } from "@/lib/controllers/goals.controller";

export const runtime = "nodejs";

export const GET = withApi(async (req) => {
  const session = await requireAuth(req);
  return json(await list(session));
});

export const POST = withApi(async (req) => {
  const session = await requireAuth(req);
  const input = parse(createSchema, await readJson(req));
  return json(await create(session, input), { status: 201 });
});
