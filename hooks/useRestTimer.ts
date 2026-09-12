"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const TICK_MS = 250;

export type RestTimer = {
  /** Whole seconds left on the clock. */
  remainingSec: number;
  durationSec: number;
  running: boolean;
  paused: boolean;
  finished: boolean;
  start: (seconds?: number) => void;
  pause: () => void;
  resume: () => void;
  skip: () => void;
  extend: (seconds: number) => void;
  setDurationSec: (seconds: number) => void;
};

/**
 * Rest countdown between sets.
 *
 * The clock is a **target timestamp**: every tick recomputes the remaining time as
 * `targetAt - Date.now()` instead of subtracting from a counter. A decrementing
 * counter drifts whenever the interval is throttled — which browsers do to
 * background tabs — and would report a rest that never actually elapsed.
 */
export function useRestTimer(initialDurationSec = 90): RestTimer {
  const [durationSec, setDurationSec] = useState(initialDurationSec);
  const [targetAt, setTargetAt] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [frozenMs, setFrozenMs] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const audio = useRef<AudioContext | null>(null);

  const beep = useCallback(() => {
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      audio.current ??= new Ctor();
      const ctx = audio.current;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.25);
    } catch {
      // Audio is a nice-to-have; a blocked AudioContext must not break the timer.
    }
  }, []);

  useEffect(() => {
    if (targetAt === null) return;

    const id = setInterval(() => {
      // Always derived from the target, never decremented.
      const left = targetAt - Date.now();
      if (left <= 0) {
        setRemainingMs(0);
        setTargetAt(null);
        setFinished(true);
        beep();
      } else {
        setRemainingMs(left);
      }
    }, TICK_MS);

    return () => clearInterval(id);
  }, [targetAt, beep]);

  const start = useCallback(
    (seconds?: number) => {
      const length = seconds ?? durationSec;
      setFrozenMs(null);
      setFinished(false);
      setRemainingMs(length * 1000);
      setTargetAt(Date.now() + length * 1000);
    },
    [durationSec],
  );

  const pause = useCallback(() => {
    setTargetAt((current) => {
      if (current === null) return null;
      setFrozenMs(Math.max(0, current - Date.now()));
      return null;
    });
  }, []);

  const resume = useCallback(() => {
    setFrozenMs((frozen) => {
      if (frozen === null) return null;
      setRemainingMs(frozen);
      setTargetAt(Date.now() + frozen);
      return null;
    });
  }, []);

  const skip = useCallback(() => {
    setTargetAt(null);
    setFrozenMs(null);
    setRemainingMs(0);
    setFinished(false);
  }, []);

  const extend = useCallback((seconds: number) => {
    setFinished(false);
    setTargetAt((current) => (current === null ? null : current + seconds * 1000));
    setFrozenMs((frozen) => (frozen === null ? null : frozen + seconds * 1000));
    setRemainingMs((current) => current + seconds * 1000);
  }, []);

  const displayMs = frozenMs ?? remainingMs;

  return {
    remainingSec: Math.ceil(displayMs / 1000),
    durationSec,
    running: targetAt !== null,
    paused: frozenMs !== null,
    finished,
    start,
    pause,
    resume,
    skip,
    extend,
    setDurationSec,
  };
}
