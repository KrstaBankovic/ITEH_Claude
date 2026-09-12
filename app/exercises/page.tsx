"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { useDebouncedFilter } from "@/hooks/useDebouncedFilter";
import { apiList, api } from "@/lib/api/client";
import type { Exercise } from "@/lib/controllers/exercises.controller";

function ExerciseCatalog() {
  const { user } = useAuth();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: "", muscleGroup: "", equipment: "" });

  async function load() {
    try {
      const { data } = await apiList<Exercise[]>("/api/exercises?page=1");
      setExercises(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load exercises.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch, not a sync setState
    void load();
  }, []);

  const { criteria, setCriteria, filtered, pending } = useDebouncedFilter({
    items: exercises,
    fields: {
      name: (e) => e.name,
      muscleGroup: (e) => e.muscleGroup,
      equipment: (e) => e.equipment,
    },
  });

  const muscleGroups = useMemo(
    () => [...new Set(exercises.map((e) => e.muscleGroup))].sort(),
    [exercises],
  );
  const equipment = useMemo(
    () => [...new Set(exercises.map((e) => e.equipment).filter(Boolean))].sort() as string[],
    [exercises],
  );

  const canCreate = user?.role === "TRAINER" || user?.role === "ADMIN";

  async function onCreate() {
    try {
      await api("/api/exercises", {
        method: "POST",
        body: JSON.stringify({
          name: draft.name,
          muscleGroup: draft.muscleGroup,
          equipment: draft.equipment || null,
        }),
      });
      setCreating(false);
      setDraft({ name: "", muscleGroup: "", equipment: "" });
      setLoading(true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the exercise.");
      setCreating(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Exercise catalog</h1>
          <p className="text-sm opacity-70">
            {filtered.length} of {exercises.length} exercises
            {pending ? " · filtering…" : ""}
          </p>
        </div>
        {canCreate ? <Button onClick={() => setCreating(true)}>New exercise</Button> : null}
      </header>

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Input
          label="Search by name"
          placeholder="bench, squat…"
          value={criteria.search}
          onChange={(e) => setCriteria({ ...criteria, search: e.target.value })}
        />
        <div className="flex flex-col gap-1">
          <label htmlFor="muscle" className="text-sm font-medium">
            Muscle group
          </label>
          <select
            id="muscle"
            value={criteria.muscleGroup}
            onChange={(e) => setCriteria({ ...criteria, muscleGroup: e.target.value })}
            className="rounded-md border border-black/15 px-3 py-2 text-sm"
          >
            <option value="">All</option>
            {muscleGroups.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="equipment" className="text-sm font-medium">
            Equipment
          </label>
          <select
            id="equipment"
            value={criteria.equipment}
            onChange={(e) => setCriteria({ ...criteria, equipment: e.target.value })}
            className="rounded-md border border-black/15 px-3 py-2 text-sm"
          >
            <option value="">All</option>
            {equipment.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="opacity-60">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="opacity-60">No exercise matches those filters.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((exercise) => (
            <Card
              key={exercise.id}
              header={
                <>
                  <span>{exercise.name}</span>
                  <Badge tone="info">{exercise.muscleGroup}</Badge>
                </>
              }
            >
              <dl className="flex flex-col gap-1 opacity-70">
                <div className="flex justify-between">
                  <dt>Equipment</dt>
                  <dd>{exercise.equipment ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Added by</dt>
                  <dd>{exercise.createdByName ?? "System"}</dd>
                </div>
              </dl>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={creating}
        title="New exercise"
        confirmLabel="Create"
        onConfirm={onCreate}
        onClose={() => setCreating(false)}
      >
        <div className="flex flex-col gap-3">
          <Input
            label="Name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <Input
            label="Muscle group"
            value={draft.muscleGroup}
            onChange={(e) => setDraft({ ...draft, muscleGroup: e.target.value })}
          />
          <Input
            label="Equipment"
            value={draft.equipment}
            onChange={(e) => setDraft({ ...draft, equipment: e.target.value })}
          />
        </div>
      </Modal>
    </main>
  );
}

export default function ExercisesPage() {
  return (
    <Suspense>
      <ExerciseCatalog />
    </Suspense>
  );
}
