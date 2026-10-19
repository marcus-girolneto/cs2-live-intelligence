"use client";
import { useEffect, useState } from "react";
import { useMatchesApi } from "@/features/matches";

/** The player's real numbers for the locked teaser ("we've seen 12 of your matches"). */
export function useTeaserCounts() {
  const api = useMatchesApi();
  const [counts, setCounts] = useState<{
    matches: number;
    maps: number;
  } | null>(null);
  useEffect(() => {
    let alive = true;
    api
      .listMatches()
      .then((list) => {
        const maps = new Set(
          list
            .map((m) => (m as { map?: unknown }).map)
            .filter((m): m is string => typeof m === "string" && m.length > 0),
        );
        if (alive) setCounts({ matches: list.length, maps: maps.size });
      })
      .catch(() => alive && setCounts({ matches: 0, maps: 0 }));
    return () => {
      alive = false;
    };
  }, [api]);
  return counts;
}
