"use client";
import { useCallback, useEffect, useState } from "react";
import { planLimitFrom, useUpgrade } from "@/features/billing";
import { usePersonalApi } from "../api/context";
import type { PersonalState } from "../model/personal";

const msg = (e: unknown) =>
  e instanceof Error ? e.message : "Request failed.";

/** Latest Personal Coach plan + "regenerate" (Pro). */
export function usePersonalCoach(enabled: boolean) {
  const api = usePersonalApi();
  const upgrade = useUpgrade();
  const [state, setState] = useState<PersonalState | null>(null);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    api
      .get()
      .then((s) => alive && setState(s))
      .catch((e: unknown) => {
        if (!alive) return;
        setState({ latest: null, history: [], nextAllowedAt: null });
        // A 402 here only means "not on Pro" — the screen shows the teaser instead.
        if (!planLimitFrom(e)) setError(msg(e));
      });
    return () => {
      alive = false;
    };
  }, [api, enabled]);
  const generate = useCallback(async () => {
    setGenerating(true);
    setError("");
    try {
      const fresh = await api.generate();
      // The POST may return only the new plan: keep the known history/cooldown then.
      const full = await api.get().catch(() => null);
      setState((prev) => ({
        latest: full?.latest ?? fresh.latest ?? prev?.latest ?? null,
        history: full?.history.length ? full.history : (prev?.history ?? []),
        nextAllowedAt: full?.nextAllowedAt ?? fresh.nextAllowedAt ?? null,
      }));
    } catch (e) {
      const limit = planLimitFrom(e);
      if (limit) upgrade.open({ ...limit, feature: "personal_coach" });
      else setError(msg(e));
    } finally {
      setGenerating(false);
    }
  }, [api, upgrade]);
  return { state, error, generating, generate };
}
