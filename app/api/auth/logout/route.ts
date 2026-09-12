import { noContent, withApi } from "@/lib/api/withApi";
import { sessionCookie } from "@/lib/auth/guard";

export const POST = withApi(async () => {
  const res = noContent();
  res.cookies.set(sessionCookie("", 0));
  return res;
});
