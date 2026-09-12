"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/components/AuthProvider";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { api } from "@/lib/api/client";
import type { Goal } from "@/lib/controllers/goals.controller";
import type { Overview, Progress } from "@/lib/controllers/stats.controller";
import type { Workout } from "@/lib/controllers/workouts.controller";

const shortDay = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: "short" });

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export default function DashboardPage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [recent, setRecent] = useState<Workout[]>([]);
  const [exerciseId, setExerciseId] = useState<number | null>(null);
  const [trend, setTrend] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [stats, loadedGoals, workouts] = await Promise.all([
          api<Overview>("/api/stats/overview"),
          api<Goal[]>("/api/goals"),
          api<Workout[]>("/api/workouts?page=1"),
        ]);
        setOverview(stats);
        setGoals(loadedGoals.filter((goal) => goal.status === "ACTIVE"));
        setRecent(workouts.slice(0, 5));
        setExerciseId(stats.loggedExercises[0]?.id ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load the dashboard.");
      }
    })();
  }, []);

  useEffect(() => {
    if (exerciseId === null) return;
    void api<Progress>(`/api/stats/progress?exerciseId=${exerciseId}`)
      .then(setTrend)
      .catch(() => setTrend(null));
  }, [exerciseId]);

  const cards = [
    { label: "Sessions logged", value: overview?.sessionCount ?? "—" },
    {
      label: "Total volume",
      value: overview ? `${Math.round(overview.totalVolumeKg).toLocaleString()} kg` : "—",
    },
    { label: "Sets last 7 days", value: overview?.setsLast7Days ?? "—" },
    { label: "Active goals", value: overview?.activeGoals ?? "—" },
  ];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold">
          {user ? `Welcome back, ${user.fullName.split(" ")[0]}` : "Dashboard"}
        </h1>
        <p className="text-sm opacity-70">Your training at a glance.</p>
      </header>

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <p className="text-xs uppercase tracking-wide opacity-60">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{card.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card header="Volume, last 7 days">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={overview?.volumeByDay ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
                <XAxis dataKey="day" tickFormatter={shortDay} fontSize={12} />
                <YAxis fontSize={12} width={48} />
                <Tooltip
                  formatter={(value) => [`${Number(value).toLocaleString()} kg`, "Volume"]}
                  labelFormatter={(label) => shortDate(String(label))}
                />
                <Bar dataKey="volumeKg" fill="#171717" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card
          header={
            <>
              <span>Estimated 1RM trend</span>
              {overview && overview.loggedExercises.length > 0 ? (
                <select
                  aria-label="Exercise"
                  value={exerciseId ?? ""}
                  onChange={(e) => setExerciseId(Number(e.target.value))}
                  className="rounded-md border border-black/15 px-2 py-1 text-xs font-normal"
                >
                  {overview.loggedExercises.map((exercise) => (
                    <option key={exercise.id} value={exercise.id}>
                      {exercise.name}
                    </option>
                  ))}
                </select>
              ) : null}
            </>
          }
        >
          <div className="h-64">
            {trend && trend.points.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend.points}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
                  <XAxis dataKey="day" tickFormatter={shortDate} fontSize={12} />
                  <YAxis fontSize={12} width={48} domain={["dataMin - 5", "dataMax + 5"]} />
                  <Tooltip
                    formatter={(value) => [`${Number(value)} kg`, "Est. 1RM"]}
                    labelFormatter={(label) => shortDate(String(label))}
                  />
                  <Line
                    type="monotone"
                    dataKey="estimated1RM"
                    stroke="#171717"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="opacity-60">Log a few sessions to see a trend.</p>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          header={
            <>
              <span>Active goals</span>
              <Link href="/goals" className="text-xs font-normal underline">
                All goals
              </Link>
            </>
          }
        >
          {goals.length === 0 ? (
            <p className="opacity-70">
              No active goals.{" "}
              <Link href="/goals" className="underline">
                Set one
              </Link>
              .
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {goals.slice(0, 4).map((goal) => (
                <li key={goal.id} className="flex flex-col gap-1">
                  <div className="flex justify-between gap-2">
                    <span>{goal.exerciseName ?? goal.goalType.replace("_", " ").toLowerCase()}</span>
                    <span className="opacity-70 tabular-nums">
                      {goal.currentValue} / {goal.targetValue} {goal.unit}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-black/10">
                    <div
                      className="h-full rounded-full bg-black/70"
                      style={{ width: `${goal.progressPct}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          header={
            <>
              <span>Recent sessions</span>
              <Link href="/workouts" className="text-xs font-normal underline">
                All workouts
              </Link>
            </>
          }
        >
          {recent.length === 0 ? (
            <p className="opacity-70">Nothing logged yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-black/5">
              {recent.map((workout) => (
                <li key={workout.id} className="flex items-center justify-between gap-2 py-1.5">
                  <Link href={`/workouts/${workout.id}`} className="hover:underline">
                    {shortDate(workout.performedAt)}
                    {workout.notes ? ` · ${workout.notes}` : ""}
                  </Link>
                  <Badge>{workout.setCount} sets</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </main>
  );
}
