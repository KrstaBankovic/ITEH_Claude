import { json, noContent, parse, readJson, withApi } from "@/lib/api/withApi";
import { routeId } from "@/lib/api/params";
import { requireAuth } from "@/lib/auth/guard";
import { remove, update, updateSchema } from "@/lib/controllers/goals.controller";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withApi(async (req, ctx: Ctx) => {
  const session = await requireAuth(req);
  const input = parse(updateSchema, await readJson(req));
  return json(await update(session, await routeId(ctx.params), input));
});

export const DELETE = withApi(async (req, ctx: Ctx) => {
  const session = await requireAuth(req);
  await remove(session, await routeId(ctx.params));
  return noContent();
});
