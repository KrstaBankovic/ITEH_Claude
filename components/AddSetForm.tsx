"use client";

import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { api } from "@/lib/api/client";
import type { Exercise } from "@/lib/controllers/exercises.controller";
import type { WorkoutSet } from "@/lib/controllers/sets.controller";

type Props = {
  workoutId: number;
  exercises: Exercise[];
  sets: WorkoutSet[];
  onAdded: (set: WorkoutSet) => void;
  onError: (message: string) => void;
};

export default function AddSetForm({ workoutId, exercises, sets, onAdded, onError }: Props) {
  const [exerciseId, setExerciseId] = useState("");
  const [reps, setReps] = useState("8");
  const [weightKg, setWeightKg] = useState("60");
  const [rpe, setRpe] = useState("");
  const [pending, setPending] = useState(false);

  // The unique constraint is (workout, exercise, set_number), so the next number
  // depends on which exercise is selected.
  const nextSetNumber = useMemo(() => {
    const chosen = Number(exerciseId);
    if (!chosen) return 1;
    const used = sets.filter((set) => set.exerciseId === chosen).map((set) => set.setNumber);
    return used.length === 0 ? 1 : Math.max(...used) + 1;
  }, [exerciseId, sets]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!exerciseId) {
      onError("Pick an exercise first.");
      return;
    }
    setPending(true);
    try {
      const created = await api<WorkoutSet>(`/api/workouts/${workoutId}/sets`, {
        method: "POST",
        body: JSON.stringify({
          exerciseId: Number(exerciseId),
          setNumber: nextSetNumber,
          reps: Number(reps),
          weightKg: Number(weightKg),
          rpe: rpe === "" ? null : Number(rpe),
        }),
      });
      onAdded(created);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not log the set.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid items-end gap-3 sm:grid-cols-5">
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label htmlFor="set-exercise" className="text-sm font-medium">
          Exercise
        </label>
        <select
          id="set-exercise"
          value={exerciseId}
          onChange={(e) => setExerciseId(e.target.value)}
          className="rounded-md border border-black/15 px-3 py-2 text-sm"
        >
          <option value="">Select…</option>
          {exercises.map((exercise) => (
            <option key={exercise.id} value={exercise.id}>
              {exercise.name} ({exercise.muscleGroup})
            </option>
          ))}
        </select>
      </div>
      <Input
        label="Reps"
        type="number"
        min={1}
        required
        value={reps}
        onChange={(e) => setReps(e.target.value)}
      />
      <Input
        label="Weight (kg)"
        type="number"
        min={0}
        step="0.5"
        required
        value={weightKg}
        onChange={(e) => setWeightKg(e.target.value)}
      />
      <Input
        label="RPE"
        type="number"
        min={1}
        max={10}
        step="0.5"
        value={rpe}
        hint={`Set #${nextSetNumber}`}
        onChange={(e) => setRpe(e.target.value)}
      />
      <Button type="submit" loading={pending} className="sm:col-span-5 sm:justify-self-start">
        Log set
      </Button>
    </form>
  );
}
