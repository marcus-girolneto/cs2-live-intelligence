"use client";
import { useAdminApi } from "../api/context";
import { useCallback, useEffect, useRef, useState } from "react";
import { errorText, isForbidden } from "../model/types";
/** Loads one admin resource; a 403 is surfaced separately so the page shows the lock state. */
export function useResource<T>(path: string, onForbidden: () => void) {
  const api = useAdminApi();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const forbidden = useRef(onForbidden);
  forbidden.current = onForbidden;
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const value = await api.read<T>(path);
      setData(value);
      setError("");
      return value;
    } catch (e) {
      if (isForbidden(e)) forbidden.current();
      setError(errorText(e, "Request failed."));
      return null;
    } finally {
      setLoading(false);
    }
  }, [api, path]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { data, setData, error, loading, reload };
}
