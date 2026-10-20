"use client";
import { useEffect, useMemo, useState } from "react";
import { useAnalysisApi } from "../api/context";
import { flaggedIds, type Integrity, type LobbyMetric } from "../model/extras";

/** Optional extras of an analysis: lobby ranks of the shown player and integrity signals. */
export function useMatchExtras(analysisId: string, steamId: string | null) {
  const api = useAnalysisApi();
  const [integrity, setIntegrity] = useState<Integrity | null>(null);
  const [lobby, setLobby] = useState<LobbyMetric[]>([]);
  useEffect(() => {
    setIntegrity(null);
    let alive = true;
    api
      .getIntegrity(analysisId)
      .then((i) => alive && setIntegrity(i))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [api, analysisId]);
  useEffect(() => {
    setLobby([]);
    if (!steamId) return;
    let alive = true;
    api
      .getLobby(analysisId, steamId)
      .then((l) => alive && setLobby(l))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [api, analysisId, steamId]);
  const flagged = useMemo(() => flaggedIds(integrity), [integrity]);
  return { integrity, lobby, flagged };
}
