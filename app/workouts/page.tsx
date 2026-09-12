"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { apiList } from "@/lib/api/client";
import type { Workout } from "@/lib/controllers/workouts.controller";

const PAGE_SIZE = 20;

export default function WorkoutsPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page) });
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    let active = true;
    void (async () => {
      setLoading(true);
      try {
        const { data, meta } = await apiList<Workout[]>(`/api/workouts?${params}`);
        if (!active) return;
        setWorkouts(data);
        setTotal(meta?.total ?? data.length);
        setError(null);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Could not load workouts.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [page, from, to]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Workouts</h1>
          <p className="text-sm opacity-70">{total} logged sessions</p>
        </div>
        <Link href="/workouts/new">
          <Button>Log a session</Button>
        </Link>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Input
          label="From"
          type="date"
          value={from}
          onChange={(e) => {
            setPage(1);
            setFrom(e.target.value);
          }}
        />
        <Input
          label="To"
          type="date"
          value={to}
          onChange={(e) => {
            setPage(1);
            setTo(e.target.value);
          }}
        />
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="opacity-60">Loading…</p>
      ) : workouts.length === 0 ? (
        <Card>
          <p className="opacity-70">
            No sessions in this range.{" "}
            <Link href="/workouts/new" className="underline">
              Log your first one
            </Link>
            .
          </p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {workouts.map((workout) => (
            <li key={workout.id}>
              <Card
                header={
                  <>
                    <Link href={`/workouts/${workout.id}`} className="hover:underline">
                      {new Date(workout.performedAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </Link>
                    {workout.planTitle ? <Badge tone="info">{workout.planTitle}</Badge> : null}
                  </>
                }
              >
                <div className="flex flex-wrap gap-x-6 gap-y-1 opacity-70">
                  <span>{workout.setCount} sets</span>
                  <span>{workout.totalVolumeKg.toLocaleString()} kg volume</span>
                  {workout.durationMin ? <span>{workout.durationMin} min</span> : null}
                  {workout.notes ? <span>{workout.notes}</span> : null}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 ? (
        <div className="flex items-center gap-3 text-sm">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="opacity-70">
            Page {page} of {pages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </main>
  );
}
