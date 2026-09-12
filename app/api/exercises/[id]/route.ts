import { json, noContent, parse, readJson, withApi } from "@/lib/api/withApi";
import { requireAuth, requireRole } from "@/lib/auth/guard";
import { get, remove, update, updateSchema } from "@/lib/controllers/exercises.controller";
import { routeId } from "@/lib/api/params";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withApi(async (req, ctx: Ctx) => {
  await requireAuth(req);
  return json(await get(await routeId(ctx.params)));
});

export const PATCH = withApi(async (req, ctx: Ctx) => {
  const session = await requireRole(req, ["TRAINER", "ADMIN"]);
  const input = parse(updateSchema, await readJson(req));
  return json(await update(session, await routeId(ctx.params), input));
});

export const DELETE = withApi(async (req, ctx: Ctx) => {
  await requireRole(req, ["ADMIN"]);
  await remove(await routeId(ctx.params));
  return noContent();
});
