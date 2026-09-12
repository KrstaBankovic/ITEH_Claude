import { json, parse, readJson, withApi } from "@/lib/api/withApi";
import { routeId } from "@/lib/api/params";
import { requireAuth } from "@/lib/auth/guard";
import { create, createSchema, listForWorkout } from "@/lib/controllers/sets.controller";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withApi(async (req, ctx: Ctx) => {
  const session = await requireAuth(req);
  return json(await listForWorkout(session, await routeId(ctx.params)));
});

export const POST = withApi(async (req, ctx: Ctx) => {
  const session = await requireAuth(req);
  const workoutId = await routeId(ctx.params);
  const input = parse(createSchema, await readJson(req));
  return json(await create(session, workoutId, input), { status: 201 });
});
