"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const DEBOUNCE_MS = 250;

export type Criteria = { search: string; muscleGroup: string; equipment: string };

type Options<T> = {
  items: T[];
  fields: { name: (item: T) => string; muscleGroup: (item: T) => string; equipment: (item: T) => string | null };
  initial?: Partial<Criteria>;
};

/**
 * Multi-criteria client-side filter with a 250 ms debounce. The committed query is
 * mirrored into the URL search params, so a filtered view can be shared or reloaded.
 */
export function useDebouncedFilter<T>({ items, fields, initial }: Options<T>) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [criteria, setCriteria] = useState<Criteria>({
    search: initial?.search ?? params.get("search") ?? "",
    muscleGroup: initial?.muscleGroup ?? params.get("muscleGroup") ?? "",
    equipment: initial?.equipment ?? params.get("equipment") ?? "",
  });
  const [debounced, setDebounced] = useState<Criteria>(criteria);

  // Only the committed (debounced) criteria drive filtering and the URL.
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(criteria), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [criteria]);

  useEffect(() => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(debounced)) {
      if (value) next.set(key, value);
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [debounced, pathname, router]);

  const filtered = useMemo(() => {
    const needle = debounced.search.trim().toLowerCase();
    return items.filter((item) => {
      if (needle && !fields.name(item).toLowerCase().includes(needle)) return false;
      if (debounced.muscleGroup && fields.muscleGroup(item) !== debounced.muscleGroup) return false;
      if (debounced.equipment && (fields.equipment(item) ?? "") !== debounced.equipment) {
        return false;
      }
      return true;
    });
    // `fields` is a literal defined at the call site; only the data and criteria matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, debounced]);

  const pending = criteria !== debounced;

  return { criteria, setCriteria, debounced, filtered, pending };
}
