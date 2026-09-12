"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AddSetForm from "@/components/AddSetForm";
import { useAuth } from "@/components/AuthProvider";
import RestTimer from "@/components/RestTimer";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { useRestTimer } from "@/hooks/useRestTimer";
import { api } from "@/lib/api/client";
import { fetchAllExercises } from "@/lib/api/exercises";
import type { Exercise } from "@/lib/controllers/exercises.controller";
import type { WorkoutSet } from "@/lib/controllers/sets.controller";
import type { Workout } from "@/lib/controllers/workouts.controller";

type Draft = { reps: string; weightKg: string; rpe: string };

export default function WorkoutDetailPage() {
  const router = useRouter();
  const { user } = useAuth();
  const workoutId = Number(useParams<{ id: string }>().id);

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>({ reps: "", weightKg: "", rpe: "" });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timer = useRestTimer(90);

  useEffect(() => {
    void (async () => {
      try {
        const [loadedWorkout, loadedSets, loadedExercises] = await Promise.all([
          api<Workout>(`/api/workouts/${workoutId}`),
          api<WorkoutSet[]>(`/api/workouts/${workoutId}/sets`),
          fetchAllExercises(),
        ]);
        setWorkout(loadedWorkout);
        setSets(loadedSets);
        setExercises(loadedExercises);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load the session.");
      } finally {
        setLoading(false);
      }
    })();
  }, [workoutId]);

  const canEdit = Boolean(workout && user && (workout.userId === user.id || user.role === "ADMIN"));

  async function refreshSets() {
    setSets(await api<WorkoutSet[]>(`/api/workouts/${workoutId}/sets`));
  }

  async function onSaveSet(set: WorkoutSet) {
    try {
      await api(`/api/workouts/${workoutId}/sets/${set.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          reps: Number(draft.reps),
          weightKg: Number(draft.weightKg),
          rpe: draft.rpe === "" ? null : Number(draft.rpe),
        }),
      });
      setEditing(null);
      await refreshSets();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the set.");
    }
  }

  async function onDeleteSet(set: WorkoutSet) {
    try {
      await api(`/api/workouts/${workoutId}/sets/${set.id}`, { method: "DELETE" });
      await refreshSets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the set.");
    }
  }

  async function onDeleteWorkout() {
    try {
      await api(`/api/workouts/${workoutId}`, { method: "DELETE" });
      router.replace("/workouts");
    } catch (err) {
      setConfirmDelete(false);
      setError(err instanceof Error ? err.message : "Could not delete the session.");
    }
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        <p className="opacity-60">Loading…</p>
      </main>
    );
  }

  if (!workout) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error ?? "Session not found."}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {new Date(workout.performedAt).toLocaleString(undefined, {
              dateStyle: "long",
              timeStyle: "short",
            })}
          </h1>
          <p className="flex flex-wrap gap-x-4 text-sm opacity-70">
            <span>{workout.userName}</span>
            <span>{workout.setCount} sets</span>
            <span>{workout.totalVolumeKg.toLocaleString()} kg volume</span>
            {workout.durationMin ? <span>{workout.durationMin} min</span> : null}
          </p>
        </div>
        {workout.planTitle ? <Badge tone="info">{workout.planTitle}</Badge> : null}
      </header>

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {workout.notes ? <Card header="Notes">{workout.notes}</Card> : null}

      <Card header="Sets">
        {sets.length === 0 ? (
          <p className="opacity-70">No sets logged for this session.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-black/10 text-xs uppercase opacity-60">
                <tr>
                  <th className="py-2 pr-3">Exercise</th>
                  <th className="py-2 pr-3">Set</th>
                  <th className="py-2 pr-3">Reps</th>
                  <th className="py-2 pr-3">Weight</th>
                  <th className="py-2 pr-3">RPE</th>
                  {canEdit ? <th className="py-2" /> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {sets.map((set) =>
                  editing === set.id ? (
                    <tr key={set.id}>
                      <td className="py-2 pr-3">{set.exerciseName}</td>
                      <td className="py-2 pr-3">{set.setNumber}</td>
                      <td className="py-2 pr-3">
                        <Input
                          type="number"
                          min={1}
                          value={draft.reps}
                          onChange={(e) => setDraft({ ...draft, reps: e.target.value })}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <Input
                          type="number"
                          min={0}
                          step="0.5"
                          value={draft.weightKg}
                          onChange={(e) => setDraft({ ...draft, weightKg: e.target.value })}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <Input
                          type="number"
                          min={1}
                          max={10}
                          step="0.5"
                          value={draft.rpe}
                          onChange={(e) => setDraft({ ...draft, rpe: e.target.value })}
                        />
                      </td>
                      <td className="flex gap-1 py-2">
                        <Button size="sm" onClick={() => onSaveSet(set)}>
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                          Cancel
                        </Button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={set.id}>
                      <td className="py-2 pr-3">{set.exerciseName}</td>
                      <td className="py-2 pr-3">{set.setNumber}</td>
                      <td className="py-2 pr-3">{set.reps}</td>
                      <td className="py-2 pr-3">{set.weightKg} kg</td>
                      <td className="py-2 pr-3">{set.rpe ?? "—"}</td>
                      {canEdit ? (
                        <td className="flex gap-1 py-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setEditing(set.id);
                              setDraft({
                                reps: String(set.reps),
                                weightKg: String(set.weightKg),
                                rpe: set.rpe === null ? "" : String(set.rpe),
                              });
                            }}
                          >
                            Edit
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => onDeleteSet(set)}>
                            Delete
                          </Button>
                        </td>
                      ) : null}
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {canEdit ? (
        <>
          <Card header="Add another set">
            <AddSetForm
              workoutId={workoutId}
              exercises={exercises}
              sets={sets}
              onAdded={(set) => {
                setSets((current) => [...current, set]);
                setError(null);
                // Logging a set starts the rest clock automatically.
                timer.start();
              }}
              onError={setError}
            />
          </Card>

          <Card header="Rest timer">
            <RestTimer timer={timer} />
          </Card>

          <div>
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              Delete session
            </Button>
          </div>
        </>
      ) : null}

      <Modal
        open={confirmDelete}
        title="Delete this session?"
        confirmLabel="Delete"
        danger
        onConfirm={onDeleteWorkout}
        onClose={() => setConfirmDelete(false)}
      >
        <p>
          This removes the session and all {sets.length} of its sets. This cannot be undone.
        </p>
      </Modal>
    </main>
  );
}
