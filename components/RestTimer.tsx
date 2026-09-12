"use client";

import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import type { RestTimer as Timer } from "@/hooks/useRestTimer";

const PRESETS = [60, 90, 120, 180];

const mmss = (totalSec: number) =>
  `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, "0")}`;

export default function RestTimer({ timer }: { timer: Timer }) {
  const active = timer.running || timer.paused;
  const elapsedFraction = active
    ? 1 - Math.min(1, timer.remainingSec / Math.max(1, timer.durationSec))
    : 0;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <div className="flex items-baseline gap-2">
        <span
          className={`font-mono text-3xl tabular-nums ${
            timer.finished ? "text-green-700" : active ? "" : "opacity-40"
          }`}
        >
          {mmss(active ? timer.remainingSec : timer.durationSec)}
        </span>
        {timer.paused ? <Badge tone="warning">Paused</Badge> : null}
        {timer.finished ? <Badge tone="success">Rest done</Badge> : null}
      </div>

      <div className="h-1.5 min-w-32 flex-1 overflow-hidden rounded-full bg-black/10">
        <div
          className="h-full rounded-full bg-black/70 transition-[width] duration-200"
          style={{ width: `${elapsedFraction * 100}%` }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!active ? (
          <Button size="sm" onClick={() => timer.start()}>
            Start rest
          </Button>
        ) : timer.paused ? (
          <Button size="sm" onClick={timer.resume}>
            Resume
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={timer.pause}>
            Pause
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => timer.extend(30)} disabled={!active}>
          +30s
        </Button>
        <Button size="sm" variant="ghost" onClick={timer.skip} disabled={!active}>
          Skip
        </Button>

        <label className="flex items-center gap-1 text-xs opacity-70">
          Rest
          <select
            value={timer.durationSec}
            onChange={(e) => timer.setDurationSec(Number(e.target.value))}
            className="rounded-md border border-black/15 px-2 py-1 text-xs"
          >
            {PRESETS.map((seconds) => (
              <option key={seconds} value={seconds}>
                {mmss(seconds)}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
