"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/shared/http";
import type { Plan } from "@/features/billing";
import { useAdminApi } from "../api/context";

export function useAdminPlans(onForbidden: () => void) {
  const api = useAdminApi();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const forbidden = useRef(onForbidden);
  forbidden.current = onForbidden;
  const fail = (e: unknown) => {
    if (e instanceof ApiError && e.status === 403) forbidden.current();
    setError(e instanceof Error ? e.message : "Request failed.");
  };
  const load = useCallback(() => {
    api
      .getPlans()
      .then((p) => {
        setPlans(p);
        setError("");
      })
      .catch(fail);
  }, [api]);
  useEffect(load, [load]);
  async function save(next: Plan[]) {
    setSaving(true);
    setNotice("");
    setError("");
    try {
      setPlans(await api.savePlans(next));
      setNotice("Plans saved.");
    } catch (e) {
      fail(e);
    } finally {
      setSaving(false);
    }
  }
  return { plans, error, notice, saving, save, reload: load };
}
