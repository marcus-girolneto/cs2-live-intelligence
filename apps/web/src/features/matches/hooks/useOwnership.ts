"use client";
import type { MatchDto } from "@/shared/api-types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMatchesApi } from "../api/context";
import type { AutoReview, Ownership, OwnershipKind } from "../model/ownership";

/** Ownership ("mine"/"external") and auto-review state of the listed demos. */
export function useOwnership(matches: MatchDto[]) {
  const api = useMatchesApi();
  const [owners, setOwners] = useState<Map<string, Ownership>>(new Map());
  const [auto, setAuto] = useState<Map<string, AutoReview>>(new Map());
  const ids = useMemo(
    () =>
      matches
        .filter((m) => m.status === "complete")
        .map((m) => m.id)
        .slice(0, 100)
        .join(","),
    [matches],
  );
  useEffect(() => {
    if (!ids) return;
    const list = ids.split(",");
    let alive = true;
    api
      .getOwnership(list)
      .then((o) => alive && setOwners(o))
      .catch(() => undefined);
    api
      .getAutoReviews(list)
      .then((a) => alive && setAuto(a))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [api, ids]);
  const mark = useCallback(
    async (
      id: string,
      ownership: OwnershipKind,
      player?: { steamId: string; name: string },
    ) => {
      await api.setOwnership(id, ownership, player?.steamId);
      setOwners((prev) => {
        const next = new Map(prev);
        next.set(id, {
          jobId: id,
          ownership,
          playerSteamId:
            ownership === "mine" ? (player?.steamId ?? null) : null,
          playerName: ownership === "mine" ? (player?.name ?? null) : null,
          matchedBy: ownership === "mine" ? "chosen" : null,
        });
        return next;
      });
    },
    [api],
  );
  return { owners, auto, mark };
}
