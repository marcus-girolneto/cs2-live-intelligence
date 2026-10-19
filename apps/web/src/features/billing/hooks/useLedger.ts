"use client";
import { useCallback, useEffect, useState } from "react";
import { useBillingApi } from "../api/context";
import type { LedgerEntry } from "../model/plans";

/** Credit history of the signed-in account. */
export function useLedger(limit = 50) {
  const api = useBillingApi();
  const [entries, setEntries] = useState<LedgerEntry[] | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    setError("");
    api
      .getLedger(limit)
      .then(setEntries)
      .catch((e: unknown) => {
        setEntries([]);
        setError(e instanceof Error ? e.message : "Request failed.");
      });
  }, [api, limit]);
  useEffect(load, [load]);
  return { entries, error, reload: load };
}
