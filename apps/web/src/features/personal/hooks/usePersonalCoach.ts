"use client";
import { useCallback, useEffect, useState } from "react";
import { planLimitFrom, useUpgrade } from "@/features/billing";
import { usePersonalApi } from "../api/context";
import {
  EMPTY_PERSONAL,
  generateErrorMessage,
  teaserFrom,
  type PersonalState,
  type PersonalTeaserCounts,
} from "../model/personal";

const msg = (e: unknown) =>
  e instanceof Error ? e.message : "Request failed.";

/**
 * Latest Personal Coach plan + "regenerate" (Pro). With `withTeaser`, non-Pro accounts also
 * ask (the 402 carries their real counts for the locked teaser).
 */
export function usePersonalCoach(enabled: boolean, withTeaser = false) {
  const api = usePersonalApi();
  const upgrade = useUpgrade();
  const [state, setState] = useState<PersonalState | null>(null);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [teaser, setTeaser] = useState<PersonalTeaserCounts | null>(null);
  useEffect(() => {
    if (!enabled && !withTeaser) return;
    let alive = true;
    api
      .get()
      .then((s) => alive && setState(s))
      .catch((e: unknown) => {
        if (!alive) return;
        setState(EMPTY_PERSONAL);
        // A 402 here only means "not on Pro": it carries the real counts for the teaser.
        const counts = teaserFrom(e);
        if (counts) setTeaser(counts);
        else if (enabled && !planLimitFrom(e)) setError(msg(e));
      });
    return () => {
      alive = false;
    };
  }, [api, enabled, withTeaser]);
  const generate = useCallback(async () => {
    setGenerating(true);
    setError("");
    try {
      const fresh = await api.generate();
      // The POST may return only the new plan: keep the known history/cooldown then.
      const full = await api.get().catch(() => null);
      setState((prev) =>
        full?.latest
          ? full
          : {
              ...(prev ?? EMPTY_PERSONAL),
              ...fresh,
              latest: fresh.latest ?? prev?.latest ?? null,
            },
      );
    } catch (e) {
      const limit = planLimitFrom(e);
      if (limit) upgrade.open({ ...limit, feature: "personal_coach" });
      else {
        setError(generateErrorMessage(e) ?? msg(e));
        // Cooldown / data errors: refresh so the screen shows the real next date.
        api.get().then(setState, () => undefined);
      }
    } finally {
      setGenerating(false);
    }
  }, [api, upgrade]);
  return { state, error, generating, generate, teaser };
}
