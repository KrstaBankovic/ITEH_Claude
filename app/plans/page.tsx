"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { api } from "@/lib/api/client";
import type { AdminUser } from "@/lib/controllers/admin.controller";
import type { Plan } from "@/lib/controllers/plans.controller";

export default function PlansPage() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [detail, setDetail] = useState<Plan | null>(null);
  const [members, setMembers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [assigning, setAssigning] = useState<Plan | null>(null);
  const [assignTo, setAssignTo] = useState("");
  const [draft, setDraft] = useState({ title: "", description: "", daysPerWeek: "3" });

  const canManage = user?.role === "TRAINER" || user?.role === "ADMIN";

  async function load() {
    setPlans(await api<Plan[]>("/api/plans"));
  }

  useEffect(() => {
    void (async () => {
      try {
        setPlans(await api<Plan[]>("/api/plans"));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load plans.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function openDetail(plan: Plan) {
    try {
      setDetail(await api<Plan>(`/api/plans/${plan.id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the plan.");
    }
  }

  async function onCreate() {
    try {
      await api("/api/plans", {
        method: "POST",
        body: JSON.stringify({
          title: draft.title,
          description: draft.description || null,
          daysPerWeek: Number(draft.daysPerWeek),
          isTemplate: true,
        }),
      });
      setCreating(false);
      setDraft({ title: "", description: "", daysPerWeek: "3" });
      setError(null);
      await load();
    } catch (err) {
      setCreating(false);
      setError(err instanceof Error ? err.message : "Could not create the plan.");
    }
  }

  async function openAssign(plan: Plan) {
    setAssigning(plan);
    setAssignTo("");
    if (members.length === 0 && user?.role === "ADMIN") {
      try {
        setMembers(await api<AdminUser[]>("/api/admin/users?role=MEMBER"));
      } catch {
        setMembers([]);
      }
    }
  }

  async function onAssign() {
    if (!assigning) return;
    try {
      await api(`/api/plans/${assigning.id}/assign`, {
        method: "POST",
        body: JSON.stringify({ userId: Number(assignTo) }),
      });
      setAssigning(null);
      setError(null);
      await load();
    } catch (err) {
      setAssigning(null);
      setError(err instanceof Error ? err.message : "Could not assign the plan.");
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Workout plans</h1>
          <p className="text-sm opacity-70">
            {canManage ? "Templates you own and plans you assigned." : "Plans assigned to you."}
          </p>
        </div>
        {canManage ? <Button onClick={() => setCreating(true)}>New template</Button> : null}
      </header>

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="opacity-60">Loading…</p>
      ) : plans.length === 0 ? (
        <Card>
          <p className="opacity-70">No plans yet.</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              header={
                <>
                  <span>{plan.title}</span>
                  {plan.isTemplate ? (
                    <Badge tone="warning">Template</Badge>
                  ) : (
                    <Badge tone="info">Assigned</Badge>
                  )}
                </>
              }
              footer={
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openDetail(plan)}>
                    View days
                  </Button>
                  {canManage && plan.trainerId === user?.id ? (
                    <Button size="sm" onClick={() => openAssign(plan)}>
                      Assign
                    </Button>
                  ) : null}
                </div>
              }
            >
              <div className="flex flex-col gap-1 opacity-70">
                {plan.description ? <p>{plan.description}</p> : null}
                <p>{plan.daysPerWeek} days per week</p>
                <p>Owner: {plan.ownerName}</p>
                {plan.trainerName ? <p>Trainer: {plan.trainerName}</p> : null}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={detail !== null}
        title={detail?.title ?? "Plan"}
        cancelLabel="Close"
        onClose={() => setDetail(null)}
      >
        {detail?.exercises && detail.exercises.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {[...new Set(detail.exercises.map((exercise) => exercise.dayIndex))].map((day) => (
              <li key={day}>
                <p className="text-xs font-semibold uppercase tracking-wide opacity-60">
                  Day {day}
                </p>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {detail.exercises
                    ?.filter((exercise) => exercise.dayIndex === day)
                    .map((exercise) => (
                      <li key={exercise.id} className="flex justify-between gap-3">
                        <span>{exercise.exerciseName}</span>
                        <span className="opacity-70">
                          {exercise.targetSets} × {exercise.targetReps}
                        </span>
                      </li>
                    ))}
                </ul>
              </li>
            ))}
          </ul>
        ) : (
          <p className="opacity-70">This plan has no exercises yet.</p>
        )}
      </Modal>

      <Modal
        open={creating}
        title="New plan template"
        confirmLabel="Create"
        onConfirm={onCreate}
        onClose={() => setCreating(false)}
      >
        <div className="flex flex-col gap-3">
          <Input
            label="Title"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
          <Input
            label="Description"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
          <Input
            label="Days per week"
            type="number"
            min={1}
            max={7}
            value={draft.daysPerWeek}
            onChange={(e) => setDraft({ ...draft, daysPerWeek: e.target.value })}
          />
        </div>
      </Modal>

      <Modal
        open={assigning !== null}
        title={`Assign "${assigning?.title ?? ""}"`}
        confirmLabel="Assign"
        onConfirm={onAssign}
        onClose={() => setAssigning(null)}
      >
        <div className="flex flex-col gap-3">
          {members.length > 0 ? (
            <div className="flex flex-col gap-1">
              <label htmlFor="assignTo" className="text-sm font-medium">
                Member
              </label>
              <select
                id="assignTo"
                value={assignTo}
                onChange={(e) => setAssignTo(e.target.value)}
                className="rounded-md border border-black/15 px-3 py-2 text-sm"
              >
                <option value="">Select…</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.fullName} ({member.email})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <Input
              label="Member id"
              type="number"
              min={1}
              value={assignTo}
              hint="A copy of this plan is created for that member."
              onChange={(e) => setAssignTo(e.target.value)}
            />
          )}
        </div>
      </Modal>
    </main>
  );
}
