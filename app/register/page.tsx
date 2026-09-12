"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { ApiClientError, api } from "@/lib/api/client";

type FieldErrors = Partial<Record<"email" | "password" | "fullName", string>>;

/** Maps the 422 `details` array from zod onto the individual inputs. */
function toFieldErrors(details: unknown): FieldErrors {
  if (!Array.isArray(details)) return {};
  const errors: FieldErrors = {};
  for (const issue of details) {
    const field = (issue as { path?: unknown[] }).path?.[0];
    const message = (issue as { message?: string }).message;
    if (typeof field === "string" && message && field in { email: 1, password: 1, fullName: 1 }) {
      errors[field as keyof FieldErrors] ??= message;
    }
  }
  return errors;
}

export default function RegisterPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setPending(true);
    try {
      await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ fullName, email, password }),
      });
      await refresh();
      router.replace("/dashboard");
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "VALIDATION_ERROR") {
        setFieldErrors(toFieldErrors(err.details));
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : "Registration failed.");
      }
      setPending(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <Card className="w-full max-w-sm" header="Create an account">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {error ? (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <Input
            label="Full name"
            required
            value={fullName}
            error={fieldErrors.fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <Input
            label="Email"
            type="email"
            required
            autoComplete="email"
            value={email}
            error={fieldErrors.email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            error={fieldErrors.password}
            hint="At least 8 characters."
            onChange={(e) => setPassword(e.target.value)}
          />

          <Button type="submit" loading={pending}>
            Create account
          </Button>

          <p className="text-sm opacity-70">
            Already registered?{" "}
            <Link href="/login" className="underline">
              Sign in
            </Link>
          </p>
        </form>
      </Card>
    </main>
  );
}
