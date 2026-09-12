import { apiList } from "@/lib/api/client";
import type { Exercise } from "@/lib/controllers/exercises.controller";

/**
 * The catalog is paginated at 20, but the set logger needs every exercise in its
 * picker, so walk the pages until the reported total is covered.
 */
export async function fetchAllExercises(): Promise<Exercise[]> {
  const all: Exercise[] = [];
  let page = 1;
  for (;;) {
    const { data, meta } = await apiList<Exercise[]>(`/api/exercises?page=${page}`);
    all.push(...data);
    if (!meta || all.length >= meta.total || data.length === 0) break;
    page += 1;
  }
  return all;
}
