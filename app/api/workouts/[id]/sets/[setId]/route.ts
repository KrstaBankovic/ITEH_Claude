import { json, noContent, parse, readJson, withApi } from "@/lib/api/withApi";
import { routeId } from "@/lib/api/params";
import { requireAuth } from "@/lib/auth/guard";
import { remove, update, updateSchema } from "@/lib/controllers/sets.controller";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; setId: string }> };

export const PATCH = withApi(async (req, ctx: Ctx) => {
  const session = await requireAuth(req);
  const workoutId = await routeId(ctx.params);
  const setId = await routeId(ctx.params, "setId");
  const input = parse(updateSchema, await readJson(req));
  return json(await update(session, workoutId, setId, input));
});

export const DELETE = withApi(async (req, ctx: Ctx) => {
  const session = await requireAuth(req);
  await remove(session, await routeId(ctx.params), await routeId(ctx.params, "setId"));
  return noContent();
});
