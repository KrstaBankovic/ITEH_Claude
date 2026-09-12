"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, type Role } from "@/components/AuthProvider";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

const LINKS: { href: string; label: string; roles?: Role[] }[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/workouts", label: "Workouts" },
  { href: "/exercises", label: "Exercises" },
  { href: "/goals", label: "Goals" },
  { href: "/plans", label: "Plans" },
  { href: "/trainer", label: "Trainer", roles: ["TRAINER", "ADMIN"] },
  { href: "/admin/users", label: "Users", roles: ["ADMIN"] },
];

const ROLE_TONE = { MEMBER: "neutral", TRAINER: "info", ADMIN: "warning" } as const;

export default function Navbar() {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  async function onLogout() {
    await logout();
    router.replace("/login");
    router.refresh();
  }

  return (
    <nav className="border-b border-black/10 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Link href={user ? "/dashboard" : "/"} className="font-semibold">
          GymTracker
        </Link>

        {user ? (
          <ul className="flex flex-wrap items-center gap-1 text-sm">
            {LINKS.filter((link) => !link.roles || link.roles.includes(user.role)).map((link) => {
              const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-md px-2.5 py-1.5 ${
                      active ? "bg-black/5 font-medium" : "hover:bg-black/5"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}

        <div className="ml-auto flex items-center gap-2 text-sm">
          {loading ? (
            <span className="opacity-60">…</span>
          ) : user ? (
            <>
              <span className="hidden opacity-70 sm:inline">{user.fullName}</span>
              <Badge tone={ROLE_TONE[user.role]}>{user.role}</Badge>
              <Button variant="secondary" size="sm" onClick={onLogout}>
                Log out
              </Button>
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-md px-2.5 py-1.5 hover:bg-black/5">
                Sign in
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-black px-2.5 py-1.5 text-white hover:bg-black/85"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
