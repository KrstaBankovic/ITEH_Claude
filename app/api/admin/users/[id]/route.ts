import { json, parse, readJson, withApi } from "@/lib/api/withApi";
import { routeId } from "@/lib/api/params";
import { requireRole } from "@/lib/auth/guard";
import { updateUser, updateUserSchema } from "@/lib/controllers/admin.controller";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withApi(async (req, ctx: Ctx) => {
  const session = await requireRole(req, ["ADMIN"]);
  const input = parse(updateUserSchema, await readJson(req));
  return json(await updateUser(session, await routeId(ctx.params), input));
});
