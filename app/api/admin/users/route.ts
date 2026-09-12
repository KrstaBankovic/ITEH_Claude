import { json, parse, withApi } from "@/lib/api/withApi";
import { requireRole } from "@/lib/auth/guard";
import { listQuerySchema, listUsers } from "@/lib/controllers/admin.controller";

export const runtime = "nodejs";

export const GET = withApi(async (req) => {
  await requireRole(req, ["ADMIN"]);
  const query = parse(listQuerySchema, Object.fromEntries(req.nextUrl.searchParams.entries()));
  return json(await listUsers(query));
});
