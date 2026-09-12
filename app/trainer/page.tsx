"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { api, apiList } from "@/lib/api/client";
import type { Plan } from "@/lib/controllers/plans.controller";
import type { Workout } from "@/lib/controllers/workouts.controller";

type Member = { id: number; name: string; plans: string[]; workouts: Workout[] };

export default function TrainerPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const plans = await api<Plan[]>("/api/plans");

        // Members are those whose plans this trainer owns; the trainer's own
        // templates are not an assignment.
        const assigned = new Map<number, { name: string; plans: string[] }>();
        for (const plan of plans) {
          if (plan.isTemplate) continue;
          const existing = assigned.get(plan.ownerId);
          if (existing) existing.plans.push(plan.title);
          else assigned.set(plan.ownerId, { name: plan.ownerName, plans: [plan.title] });
        }

        const loaded = await Promise.all(
          [...assigned.entries()].map(async ([id, info]) => {
            const { data } = await apiList<Workout[]>(`/api/workouts?userId=${id}&page=1`);
            return { id, name: info.name, plans: info.plans, workouts: data.slice(0, 5) };
          }),
        );
        setMembers(loaded);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load your members.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold">Your members</h1>
        <p className="text-sm opacity-70">
          Members you have assigned a plan to, and their recent sessions. Read-only.
        </p>
      </header>

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="opacity-60">Loading…</p>
      ) : members.length === 0 ? (
        <Card>
          <p className="opacity-70">
            No members yet. Assign a plan from{" "}
            <Link href="/plans" className="underline">
              Plans
            </Link>{" "}
            and they will appear here.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {members.map((member) => (
            <Card
              key={member.id}
              header={
                <>
                  <span>{member.name}</span>
                  <Badge tone="info">{member.workouts.length} recent</Badge>
                </>
              }
            >
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide opacity-60">Plans</p>
                  <p className="opacity-80">{member.plans.join(", ")}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide opacity-60">Recent sessions</p>
                  {member.workouts.length === 0 ? (
                    <p className="opacity-70">Nothing logged yet.</p>
                  ) : (
                    <ul className="mt-1 flex flex-col divide-y divide-black/5">
                      {member.workouts.map((workout) => (
                        <li key={workout.id} className="flex justify-between gap-3 py-1.5">
                          <Link href={`/workouts/${workout.id}`} className="hover:underline">
                            {new Date(workout.performedAt).toLocaleDateString(undefined, {
                              dateStyle: "medium",
                            })}
                          </Link>
                          <span className="opacity-70">
                            {workout.setCount} sets · {workout.totalVolumeKg.toLocaleString()} kg
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
