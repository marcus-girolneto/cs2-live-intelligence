"use client";
import { useEffect, useState } from "react";
import { useCoachApi } from "../api/context";

/** "mine" / "external" for the chosen demo (null while unknown). */
export function useMatchOwnership(matchId: string | null) {
  const api = useCoachApi();
  const [kind, setKind] = useState<"mine" | "external" | null>(null);
  useEffect(() => {
    setKind(null);
    if (!matchId) return;
    let alive = true;
    api
      .matchOwnership(matchId)
      .then((k) => alive && setKind(k))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [api, matchId]);
  return kind;
}
