"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import { api } from "@/lib/api/client";
import type { AdminUser } from "@/lib/controllers/admin.controller";
import { ROLE_VALUES, type Role } from "@/lib/domain";

const ROLE_TONE = { MEMBER: "neutral", TRAINER: "info", ADMIN: "warning" } as const;

export default function AdminUsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roleFilter, setRoleFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState<AdminUser | null>(null);

  async function load(role = roleFilter) {
    const query = role ? `?role=${role}` : "";
    setUsers(await api<AdminUser[]>(`/api/admin/users${query}`));
  }

  useEffect(() => {
    void (async () => {
      try {
        const query = roleFilter ? `?role=${roleFilter}` : "";
        setUsers(await api<AdminUser[]>(`/api/admin/users${query}`));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load users.");
      } finally {
        setLoading(false);
      }
    })();
  }, [roleFilter]);

  async function onChangeRole(target: AdminUser, role: Role) {
    try {
      await api(`/api/admin/users/${target.id}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      setError(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change the role.");
    }
  }

  async function onSetActive(target: AdminUser, isActive: boolean) {
    try {
      await api(`/api/admin/users/${target.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      });
      setDeactivating(null);
      setError(null);
      await load();
    } catch (err) {
      setDeactivating(null);
      setError(err instanceof Error ? err.message : "Could not change the account state.");
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-sm opacity-70">{users.length} accounts</p>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="roleFilter" className="text-sm font-medium">
            Role
          </label>
          <select
            id="roleFilter"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-md border border-black/15 px-3 py-2 text-sm"
          >
            <option value="">All</option>
            {ROLE_VALUES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>
      </header>

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <Card>
        {loading ? (
          <p className="opacity-60">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-black/10 text-xs uppercase opacity-60">
                <tr>
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Sessions</th>
                  <th className="py-2 pr-3">State</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {users.map((row) => {
                  const isSelf = row.id === user?.id;
                  return (
                    <tr key={row.id}>
                      <td className="py-2 pr-3 tabular-nums opacity-60">{row.id}</td>
                      <td className="py-2 pr-3">
                        {row.fullName}
                        {isSelf ? <span className="ml-1 opacity-50">(you)</span> : null}
                      </td>
                      <td className="py-2 pr-3 opacity-70">{row.email}</td>
                      <td className="py-2 pr-3">
                        {isSelf ? (
                          <Badge tone={ROLE_TONE[row.role]}>{row.role}</Badge>
                        ) : (
                          <select
                            aria-label={`Role for ${row.fullName}`}
                            value={row.role}
                            onChange={(e) => onChangeRole(row, e.target.value as Role)}
                            className="rounded-md border border-black/15 px-2 py-1 text-xs"
                          >
                            {ROLE_VALUES.map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">{row.workoutCount}</td>
                      <td className="py-2 pr-3">
                        {row.isActive ? (
                          <Badge tone="success">Active</Badge>
                        ) : (
                          <Badge tone="danger">Disabled</Badge>
                        )}
                      </td>
                      <td className="py-2">
                        {isSelf ? null : row.isActive ? (
                          <Button size="sm" variant="secondary" onClick={() => setDeactivating(row)}>
                            Deactivate
                          </Button>
                        ) : (
                          <Button size="sm" onClick={() => onSetActive(row, true)}>
                            Reactivate
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={deactivating !== null}
        title={`Deactivate ${deactivating?.fullName ?? ""}?`}
        confirmLabel="Deactivate"
        danger
        onConfirm={() => (deactivating ? onSetActive(deactivating, false) : undefined)}
        onClose={() => setDeactivating(null)}
      >
        <p>They will not be able to sign in until the account is reactivated.</p>
      </Modal>
    </main>
  );
}
