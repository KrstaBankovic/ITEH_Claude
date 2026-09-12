import { json, parse, readJson, withApi } from "@/lib/api/withApi";
import { sessionCookie } from "@/lib/auth/guard";
import { register, registerSchema } from "@/lib/controllers/auth.controller";

// bcryptjs does not run on the Edge runtime.
export const runtime = "nodejs";

export const POST = withApi(async (req) => {
  const input = parse(registerSchema, await readJson(req));
  const { user, token } = await register(input);
  const res = json(user, { status: 201 });
  res.cookies.set(sessionCookie(token));
  return res;
});
