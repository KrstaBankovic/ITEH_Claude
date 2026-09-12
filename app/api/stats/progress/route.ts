import { json, parse, withApi } from "@/lib/api/withApi";
import { requireAuth } from "@/lib/auth/guard";
import { progress, progressQuerySchema } from "@/lib/controllers/stats.controller";

export const runtime = "nodejs";

export const GET = withApi(async (req) => {
  const session = await requireAuth(req);
  const query = parse(
    progressQuerySchema,
    Object.fromEntries(req.nextUrl.searchParams.entries()),
  );
  return json(await progress(session, query));
});
