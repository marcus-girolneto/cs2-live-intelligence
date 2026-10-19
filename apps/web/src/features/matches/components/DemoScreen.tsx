"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnalysisView, type AnalysisResult } from "@/features/analysis";
import { useI18n } from "@/shared/i18n";
import { Play, Upload } from "@/shared/icons";
import { PageLoader, Callout, EmptyState, PageHeader } from "@/shared/ui";
import { useMatchesApi } from "../api/context";
import { SampleImport } from "./SampleImport";
/** /demo: the sample (or newest) analysed match. */
export function DemoScreen() {
  const { t } = useI18n();
  const api = useMatchesApi();
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const matches = await api.listMatches();
        const done = matches
          .filter((m) => m.status === "complete" && m.analysisId)
          .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
        const ready =
          done.find((m) => m.filename === "public-cs2.dem") ?? done[0];
        if (ready) setResult(await api.getAnalysis(ready.analysisId!));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load the demo.");
      } finally {
        setLoading(false);
      }
    })();
  }, [api]);
  return (
    <main className="page">
      <PageHeader
        eyebrow={t("Sample demo")}
        icon={<Play size={16} />}
        title={t("See an analyzed match")}
        lead={t(
          "Pick a player, then switch between the overview, the AI Coach review and every round. Every number comes straight from the demo's events.",
        )}
      />
      {error && (
        <Callout tone="error" role="alert">
          {t(error)}
        </Callout>
      )}
      {loading && <PageLoader label={t("Loading analysis…")} />}
      {!loading && !result && !error && (
        <EmptyState
          icon={<Play size={28} />}
          title={t("No analyzed demo yet")}
          actions={
            <Link className="btn btn-ghost" href="/upload">
              <Upload size={18} /> {t("Upload demo")}
            </Link>
          }
        >
          <p>{t("Upload a .dem file to see your first analysis.")}</p>
          <SampleImport />
        </EmptyState>
      )}
      {result && <AnalysisView result={result} />}
    </main>
  );
}
