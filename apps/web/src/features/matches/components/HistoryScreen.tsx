"use client";
import type { MatchDto } from "@/shared/api-types";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnalysisView, type AnalysisResult } from "@/features/analysis";
import { useMapsApi } from "@/features/maps";
import { finite } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { Crosshair, Upload } from "@/shared/icons";
import {
  PageLoader,
  RadarLoader,
  Callout,
  EmptyState,
  PageHeader,
  Panel,
  Skeleton,
} from "@/shared/ui";
import { useMatchesApi } from "../api/context";
import { PENDING, type MatchSummary } from "../model/status";
import { FeedbackForm } from "./FeedbackForm";
import { MatchRow } from "./MatchRow";
import { SampleImport } from "./SampleImport";
/** /history: match list (polled while processing) and the selected analysis. */
export function HistoryScreen() {
  const { t } = useI18n();
  const api = useMatchesApi();
  const maps = useMapsApi();
  const [matches, setMatches] = useState<MatchDto[]>([]);
  const [selected, setSelected] = useState<MatchDto | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [summaries, setSummaries] = useState<Map<string, MatchSummary>>(
    new Map(),
  );
  const selectedRef = useRef<string | null>(null);
  async function refresh() {
    try {
      const list = await api.listMatches();
      const sorted = [...list].sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
      );
      setMatches(sorted);
      setError("");
      return sorted;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load matches.");
      return [];
    } finally {
      setLoading(false);
    }
  }
  async function select(id: string, quiet = false) {
    selectedRef.current = id;
    if (!quiet) {
      setError("");
      setLoadingAnalysis(true);
    }
    try {
      const match = await api.getMatch(id);
      if (selectedRef.current !== id) return;
      setSelected(match);
      const analysis =
        match.analysisId && match.status === "complete"
          ? await api.getAnalysis(match.analysisId)
          : null;
      if (selectedRef.current !== id) return;
      setResult((prev) =>
        analysis && prev?.id === analysis.id ? prev : analysis,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the analysis.");
    } finally {
      if (selectedRef.current === id) setLoadingAnalysis(false);
    }
  }
  useEffect(() => {
    void refresh().then((list) => {
      const wanted = new URLSearchParams(window.location.search).get("match");
      const first =
        list.find((m) => m.id === wanted || m.analysisId === wanted) ?? list[0];
      if (first) void select(first.id);
    });
    maps
      .getProgress()
      .then((p) =>
        setSummaries(
          new Map(
            p.timeline.map((e) => [
              e.analysisId,
              {
                map: typeof e.map === "string" ? e.map : null,
                adr: finite(e.adr),
                kills: finite(e.kills),
                deaths: finite(e.deaths),
              },
            ]),
          ),
        ),
      )
      .catch(() => undefined);
    const timer = setInterval(() => void refresh(), 5000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!selected || !PENDING.includes(selected.status)) return;
    const timer = setInterval(() => void select(selected.id, true), 3000);
    return () => clearInterval(timer);
  }, [selected]);
  const mapFor = useMemo(() => {
    const m = new Map(summaries);
    if (result)
      m.set(result.id, {
        ...(m.get(result.id) ?? {}),
        map: result.analysis.map ?? null,
      });
    return m;
  }, [summaries, result]);
  const visible = showAll ? matches : matches.slice(0, 4);
  return (
    <main className="page">
      <PageHeader
        eyebrow={t("My matches")}
        title={t("Your demos")}
        lead={t("Pick a match to see its analysis.")}
        icon={<Crosshair size={16} />}
        actions={
          <Link className="btn btn-primary" href="/upload">
            <Upload size={18} /> {t("Upload demo")}
          </Link>
        }
      />
      {error && (
        <Callout tone="error" role="alert">
          {t(error)}
        </Callout>
      )}
      {loading ? (
        <div className="match-list">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={64} />
          ))}
        </div>
      ) : matches.length === 0 ? (
        <EmptyState
          icon={<Crosshair size={28} />}
          title={t("No demos uploaded yet")}
          actions={
            <Link className="btn btn-ghost" href="/upload">
              <Upload size={18} /> {t("Upload demo")}
            </Link>
          }
        >
          <SampleImport />
        </EmptyState>
      ) : (
        <Panel className="flat matches-panel">
          <div className="match-list stagger">
            {visible.map((m) => (
              <MatchRow
                key={m.id}
                match={m}
                summary={mapFor.get(m.analysisId ?? m.id)}
                selected={selected?.id === m.id}
                onClick={() => void select(m.id)}
              />
            ))}
          </div>
          {matches.length > 4 && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowAll((s) => !s)}
            >
              {showAll
                ? t("Show fewer")
                : t("Show all {n} matches", { n: matches.length })}
            </button>
          )}
        </Panel>
      )}
      {selected && PENDING.includes(selected.status) && (
        <RadarLoader
          label={t("Analyzing the demo… this takes a few seconds.")}
        />
      )}
      {selected?.status === "failed" && (
        <Callout
          tone="error"
          role="alert"
          title={t("This demo could not be read.")}
        >
          <p>
            {selected.error ?? t("Check that it is a valid CS2 .dem file.")}
          </p>
        </Callout>
      )}
      {loadingAnalysis && !result && (
        <PageLoader label={t("Loading analysis…")} />
      )}
      {result && <AnalysisView key={result.id} result={result} />}
      {result && <FeedbackForm />}
    </main>
  );
}
