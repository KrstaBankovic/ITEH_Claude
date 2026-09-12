import { json, parse, readJson, withApi } from "@/lib/api/withApi";
import { sessionCookie } from "@/lib/auth/guard";
import { login, loginSchema } from "@/lib/controllers/auth.controller";

// bcryptjs does not run on the Edge runtime.
export const runtime = "nodejs";

export const POST = withApi(async (req) => {
  const input = parse(loginSchema, await readJson(req));
  const { user, token } = await login(input);
  const res = json(user);
  res.cookies.set(sessionCookie(token));
  return res;
});
