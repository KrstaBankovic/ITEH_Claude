/**
 * Estimated one-rep max, Epley: `1RM = w × (1 + reps / 30)`.
 *
 * A single heavy set is not the same as a strength gain, so the trend is built from
 * the best estimate per training day: a lighter set taken for more reps can imply a
 * higher 1RM than a heavier set taken for one, which is why the maximum has to be
 * taken over the estimate rather than over the raw weight.
 */
export function epley1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  return weightKg * (1 + reps / 30);
}

/** One distinct weight/rep pairing performed on a given day. */
export type SetSample = { day: string; weightKg: number; reps: number };

export type OneRepMaxPoint = { day: string; estimated1RM: number };

/** Reduces day-grouped samples to one best estimated 1RM per day, oldest first. */
export function oneRepMaxTrend(samples: SetSample[]): OneRepMaxPoint[] {
  const bestByDay = new Map<string, number>();

  for (const sample of samples) {
    const estimate = epley1RM(sample.weightKg, sample.reps);
    const best = bestByDay.get(sample.day);
    if (best === undefined || estimate > best) bestByDay.set(sample.day, estimate);
  }

  return [...bestByDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, estimate]) => ({ day, estimated1RM: Math.round(estimate * 10) / 10 }));
}
