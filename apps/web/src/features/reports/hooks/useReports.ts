"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useUpgrade } from "@/features/billing";
import { useReportsApi } from "../api/context";
import type { Report, ReportListItem } from "../model/report";

const msg = (e: unknown) =>
  e instanceof Error ? e.message : "Request failed.";

/** Report list → selected report; "generate this month" for Pro. */
export function useReports(enabled: boolean) {
  const api = useReportsApi();
  const upgrade = useUpgrade();
  const [list, setList] = useState<ReportListItem[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const held = useRef<string | null>(null);
  held.current = report?.id ?? null;
  useEffect(() => {
    if (!enabled) return setList([]);
    api
      .list()
      .then((l) => {
        setList(l);
        setSelected((s) => s ?? l[0]?.id ?? null);
      })
      .catch((e: unknown) => {
        setList([]);
        setError(msg(e));
      });
  }, [api, enabled]);
  useEffect(() => {
    if (!selected) return setReport(null);
    if (held.current === selected) return;
    let alive = true;
    setLoading(true);
    api
      .get(selected)
      .then((r) => alive && setReport(r))
      .catch((e: unknown) => alive && setError(msg(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [api, selected]);
  const generate = useCallback(async () => {
    setGenerating(true);
    setError("");
    try {
      const r = await api.generate();
      const l = await api.list().catch(() => null);
      if (l) setList(l);
      if (r.report) setReport(r.report);
      if (r.id) setSelected(r.id);
    } catch (e) {
      if (!upgrade.handle(e)) setError(msg(e));
    } finally {
      setGenerating(false);
    }
  }, [api, upgrade]);
  return {
    list,
    selected,
    select: setSelected,
    report,
    loading,
    error,
    generating,
    generate,
  };
}
