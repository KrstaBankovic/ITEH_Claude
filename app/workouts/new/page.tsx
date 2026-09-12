"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AddSetForm from "@/components/AddSetForm";
import RestTimer from "@/components/RestTimer";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { useRestTimer } from "@/hooks/useRestTimer";
import { api } from "@/lib/api/client";
import { fetchAllExercises } from "@/lib/api/exercises";
import type { Exercise } from "@/lib/controllers/exercises.controller";
import type { WorkoutSet } from "@/lib/controllers/sets.controller";
import type { Workout } from "@/lib/controllers/workouts.controller";

/** A local datetime string that `<input type="datetime-local">` accepts. */
function nowLocal(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

export default function NewWorkoutPage() {
  const router = useRouter();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [performedAt, setPerformedAt] = useState(nowLocal);
  const [durationMin, setDurationMin] = useState("");
  const [notes, setNotes] = useState("");
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const timer = useRestTimer(90);

  useEffect(() => {
    void fetchAllExercises()
      .then(setExercises)
      .catch(() => setError("Could not load the exercise catalog."));
  }, []);

  async function onStart(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const created = await api<Workout>("/api/workouts", {
        method: "POST",
        body: JSON.stringify({
          performedAt: new Date(performedAt).toISOString(),
          durationMin: durationMin === "" ? null : Number(durationMin),
          notes: notes.trim() === "" ? null : notes.trim(),
        }),
      });
      setWorkout(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the session.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">Log a session</h1>

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {!workout ? (
        <Card header="Session details">
          <form onSubmit={onStart} className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label htmlFor="performedAt" className="text-sm font-medium">
                  Performed at
                </label>
                <input
                  id="performedAt"
                  type="datetime-local"
                  required
                  value={performedAt}
                  onChange={(e) => setPerformedAt(e.target.value)}
                  className="rounded-md border border-black/15 px-3 py-2 text-sm"
                />
              </div>
              <Input
                label="Duration (min)"
                type="number"
                min={1}
                max={600}
                value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)}
              />
            </div>
            <Input
              label="Notes"
              value={notes}
              placeholder="Push day, felt strong"
              onChange={(e) => setNotes(e.target.value)}
            />
            <Button type="submit" loading={pending} className="self-start">
              Start logging sets
            </Button>
          </form>
        </Card>
      ) : (
        <>
          <Card
            header={
              <>
                <span>
                  Session on{" "}
                  {new Date(workout.performedAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
                <Badge tone="success">{sets.length} sets</Badge>
              </>
            }
          >
            <AddSetForm
              workoutId={workout.id}
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

          {sets.length > 0 ? (
            <Card header="Logged so far">
              <ul className="flex flex-col divide-y divide-black/5">
                {sets.map((set) => (
                  <li key={set.id} className="flex justify-between gap-3 py-1.5">
                    <span>
                      {set.exerciseName} · set {set.setNumber}
                    </span>
                    <span className="opacity-70">
                      {set.reps} × {set.weightKg} kg{set.rpe ? ` · RPE ${set.rpe}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <div className="flex gap-2">
            <Button onClick={() => router.push(`/workouts/${workout.id}`)}>Finish session</Button>
            <Button variant="secondary" onClick={() => router.push("/workouts")}>
              Back to list
            </Button>
          </div>
        </>
      )}
    </main>
  );
}
