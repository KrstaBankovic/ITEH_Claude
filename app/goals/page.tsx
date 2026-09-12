"use client";

import { useEffect, useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { api } from "@/lib/api/client";
import { fetchAllExercises } from "@/lib/api/exercises";
import type { Exercise } from "@/lib/controllers/exercises.controller";
import type { Goal } from "@/lib/controllers/goals.controller";
import { GOAL_TYPES, type GoalType } from "@/lib/domain";

const STATUS_TONE = { ACTIVE: "info", ACHIEVED: "success", ABANDONED: "neutral" } as const;

const DEFAULT_UNIT: Record<GoalType, string> = {
  MAX_WEIGHT: "kg",
  TOTAL_VOLUME: "kg",
  SESSION_COUNT: "sessions",
  BODY_WEIGHT: "kg",
};

const label = (type: GoalType) =>
  type.toLowerCase().replace("_", " ").replace(/^./, (c) => c.toUpperCase());

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<Goal | null>(null);
  const [draft, setDraft] = useState({
    goalType: "MAX_WEIGHT" as GoalType,
    exerciseId: "",
    targetValue: "",
    deadline: "",
  });

  async function load() {
    setGoals(await api<Goal[]>("/api/goals"));
  }

  useEffect(() => {
    void (async () => {
      try {
        const [loadedGoals, loadedExercises] = await Promise.all([
          api<Goal[]>("/api/goals"),
          fetchAllExercises(),
        ]);
        setGoals(loadedGoals);
        setExercises(loadedExercises);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load goals.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function onCreate() {
    try {
      await api("/api/goals", {
        method: "POST",
        body: JSON.stringify({
          goalType: draft.goalType,
          exerciseId: draft.exerciseId === "" ? null : Number(draft.exerciseId),
          targetValue: Number(draft.targetValue),
          unit: DEFAULT_UNIT[draft.goalType],
          deadline: draft.deadline === "" ? null : draft.deadline,
        }),
      });
      setCreating(false);
      setDraft({ goalType: "MAX_WEIGHT", exerciseId: "", targetValue: "", deadline: "" });
      setError(null);
      await load();
    } catch (err) {
      setCreating(false);
      setError(err instanceof Error ? err.message : "Could not create the goal.");
    }
  }

  async function onSetStatus(goal: Goal, status: Goal["status"]) {
    try {
      await api(`/api/goals/${goal.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the goal.");
    }
  }

  async function onRemove() {
    if (!removing) return;
    try {
      await api(`/api/goals/${removing.id}`, { method: "DELETE" });
      setRemoving(null);
      await load();
    } catch (err) {
      setRemoving(null);
      setError(err instanceof Error ? err.message : "Could not delete the goal.");
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Goals</h1>
          <p className="text-sm opacity-70">
            {goals.filter((goal) => goal.status === "ACTIVE").length} active of {goals.length}
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>New goal</Button>
      </header>

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="opacity-60">Loading…</p>
      ) : goals.length === 0 ? (
        <Card>
          <p className="opacity-70">No goals yet. Set a target and the progress bar fills in.</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => (
            <Card
              key={goal.id}
              header={
                <>
                  <span>{goal.exerciseName ?? label(goal.goalType)}</span>
                  <Badge tone={STATUS_TONE[goal.status]}>{goal.status}</Badge>
                </>
              }
              footer={
                <div className="flex flex-wrap gap-2">
                  {goal.status === "ACTIVE" ? (
                    <>
                      <Button size="sm" onClick={() => onSetStatus(goal, "ACHIEVED")}>
                        Mark achieved
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onSetStatus(goal, "ABANDONED")}
                      >
                        Abandon
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => onSetStatus(goal, "ACTIVE")}>
                      Reactivate
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setRemoving(goal)}>
                    Delete
                  </Button>
                </div>
              }
            >
              <div className="flex flex-col gap-2">
                <p className="text-xs uppercase tracking-wide opacity-60">
                  {label(goal.goalType)}
                </p>
                <div className="flex justify-between gap-2 tabular-nums">
                  <span className="text-lg font-semibold">
                    {goal.currentValue} {goal.unit}
                  </span>
                  <span className="opacity-70">
                    of {goal.targetValue} {goal.unit}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-black/10">
                  <div
                    className={`h-full rounded-full ${
                      goal.progressPct >= 100 ? "bg-green-600" : "bg-black/70"
                    }`}
                    style={{ width: `${goal.progressPct}%` }}
                  />
                </div>
                <p className="text-xs opacity-60">
                  {goal.progressPct}% · {goal.deadline ? `due ${goal.deadline}` : "no deadline"}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={creating}
        title="New goal"
        confirmLabel="Create"
        onConfirm={onCreate}
        onClose={() => setCreating(false)}
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="goalType" className="text-sm font-medium">
              Goal type
            </label>
            <select
              id="goalType"
              value={draft.goalType}
              onChange={(e) =>
                setDraft({ ...draft, goalType: e.target.value as GoalType, exerciseId: "" })
              }
              className="rounded-md border border-black/15 px-3 py-2 text-sm"
            >
              {GOAL_TYPES.map((type) => (
                <option key={type} value={type}>
                  {label(type)}
                </option>
              ))}
            </select>
          </div>

          {draft.goalType === "MAX_WEIGHT" ? (
            <div className="flex flex-col gap-1">
              <label htmlFor="goalExercise" className="text-sm font-medium">
                Exercise
              </label>
              <select
                id="goalExercise"
                value={draft.exerciseId}
                onChange={(e) => setDraft({ ...draft, exerciseId: e.target.value })}
                className="rounded-md border border-black/15 px-3 py-2 text-sm"
              >
                <option value="">Select…</option>
                {exercises.map((exercise) => (
                  <option key={exercise.id} value={exercise.id}>
                    {exercise.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <Input
            label={`Target (${DEFAULT_UNIT[draft.goalType]})`}
            type="number"
            min={1}
            step="0.5"
            value={draft.targetValue}
            onChange={(e) => setDraft({ ...draft, targetValue: e.target.value })}
          />
          <Input
            label="Deadline"
            type="date"
            value={draft.deadline}
            onChange={(e) => setDraft({ ...draft, deadline: e.target.value })}
          />
        </div>
      </Modal>

      <Modal
        open={removing !== null}
        title="Delete this goal?"
        confirmLabel="Delete"
        danger
        onConfirm={onRemove}
        onClose={() => setRemoving(null)}
      >
        <p>This cannot be undone.</p>
      </Modal>
    </main>
  );
}
