import { json, withApi } from "@/lib/api/withApi";
import { requireAuth } from "@/lib/auth/guard";
import { me } from "@/lib/controllers/auth.controller";

export const runtime = "nodejs";

export const GET = withApi(async (req) => {
  const session = await requireAuth(req);
  return json(await me(session.userId));
});
