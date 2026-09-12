import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/guard";

const PROTECTED = [
  "/dashboard",
  "/workouts",
  "/exercises",
  "/goals",
  "/plans",
  "/profile",
  "/trainer",
  "/admin",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!PROTECTED.some((prefix) => pathname.startsWith(prefix))) return NextResponse.next();

  const session = await getSession(req);
  if (!session) {
    const login = new URL("/login", req.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (pathname.startsWith("/admin") && session.role !== "ADMIN") {
    return new NextResponse("Forbidden", { status: 403 });
  }
  if (pathname.startsWith("/trainer") && session.role === "MEMBER") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/workouts/:path*",
    "/exercises/:path*",
    "/goals/:path*",
    "/plans/:path*",
    "/profile/:path*",
    "/trainer/:path*",
    "/admin/:path*",
  ],
};
