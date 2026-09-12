import { json, parse, readJson, withApi } from "@/lib/api/withApi";
import { routeId } from "@/lib/api/params";
import { requireRole } from "@/lib/auth/guard";
import { assign, assignSchema } from "@/lib/controllers/plans.controller";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withApi(async (req, ctx: Ctx) => {
  const session = await requireRole(req, ["TRAINER", "ADMIN"]);
  const planId = await routeId(ctx.params);
  const { userId } = parse(assignSchema, await readJson(req));
  return json(await assign(session, planId, userId), { status: 201 });
});
