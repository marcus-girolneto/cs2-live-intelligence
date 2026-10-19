"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useUpgrade, useUsage } from "@/features/billing";
import {
  PROGRESS_METRICS,
  type Progress,
  MapProgressView,
  generalPlanOf,
  mapKey,
  mapsOf,
  useMapsApi,
} from "@/features/maps";
import { finite, formatDate, mapName } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { Chart, Trend, User } from "@/shared/icons";
import {
  PageLoader,
  Callout,
  EmptyState,
  PageHeader,
  Panel,
} from "@/shared/ui";
import { CHART } from "../model/chart";
import { LearnedPanel } from "./LearnedPanel";
import { LineChart } from "./LineChart";
import { LiveCalls } from "./LiveCalls";
import { ProgressStats } from "./ProgressStats";
import { ReviewHistory } from "./ReviewHistory";
/** /progress: learned profile, per-map progress, match-by-match chart, reviews and live calls. */
export function ProgressScreen() {
  const { t, locale } = useI18n();
  const api = useMapsApi();
  const [data, setData] = useState<Progress | null>(null);
  const [error, setError] = useState("");
  const [chart, setChart] = useState<(typeof CHART)[number]>("adr");
  const [map, setMap] = useState<string | null>(null);
  const { limits, isAdmin } = useUsage();
  const upgrade = useUpgrade();
  useEffect(() => {
    api
      .getProgress()
      .then(setData)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Request failed."),
      );
  }, [api]);
  async function rate(id: string, rating: number) {
    await api.rateReview(id, rating).catch(() => undefined);
    setData(
      (d) =>
        d && {
          ...d,
          reviews: d.reviews.map((r) => (r.id === id ? { ...r, rating } : r)),
        },
    );
  }
  const header = (
    <PageHeader
      eyebrow={t("Your progress")}
      icon={<Trend size={16} />}
      title={t("How you are evolving")}
      lead={t(
        "Everything here is saved to your account: every analyzed match, every AI review and every live call. The coach uses it to adapt to you.",
      )}
    />
  );
  if (error)
    return (
      <main className="page">
        {header}
        <Callout tone="error" role="alert">
          {t(error)}
        </Callout>
      </main>
    );
  if (!data)
    return (
      <main className="page">
        {header}
        <PageLoader />
      </main>
    );
  const def = PROGRESS_METRICS.find((m) => m.key === chart)!;
  const maps = mapsOf(data);
  const points = data.timeline
    .filter((m) => !map || mapKey(m.map) === map)
    .map((m, i) => ({ i, m, v: finite(m[chart]) }))
    .filter(
      (p): p is { i: number; m: (typeof data.timeline)[number]; v: number } =>
        p.v !== null,
    );
  return (
    <main className="page">
      {header}
      {!data.playerSteamId && (
        <Callout tone="info" title={t("Tell the coach which player you are")}>
          <p>
            {t("Sign in with Steam, or open a demo and press “This is me”.")}
          </p>
          <p>
            <Link href="/history">{t("Open a demo")} →</Link>
          </p>
        </Callout>
      )}

      {data.profile ? (
        <>
          <ProgressStats profile={data.profile} />
          <LearnedPanel profile={data.profile} />
        </>
      ) : (
        <EmptyState
          icon={<Chart size={28} />}
          title={t("No progress yet")}
          actions={
            <Link className="btn btn-primary" href="/upload">
              {t("Upload demo")}
            </Link>
          }
        >
          <p>{t("Analyze a match to start tracking your form.")}</p>
        </EmptyState>
      )}

      {(maps.length > 0 || data.reviews.length > 0) && (
        <MapProgressView
          maps={maps}
          general={generalPlanOf(data)}
          value={map}
          onChange={setMap}
          lockedDeepLearning={!isAdmin && limits?.perMapLearning === false}
          onUpsell={() => upgrade.open({ feature: "per_map", limit: null })}
        />
      )}

      {points.length > 0 && (
        <Panel
          icon={<Chart size={20} />}
          title={t("Match by match")}
          sub={
            map
              ? t("Only matches on {map}", { map: mapName(map) ?? map })
              : undefined
          }
          actions={
            <div className="segmented" role="group" aria-label={t("Metric")}>
              {CHART.map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={chart === k}
                  onClick={() => setChart(k)}
                >
                  {t(PROGRESS_METRICS.find((m) => m.key === k)!.label)}
                </button>
              ))}
            </div>
          }
        >
          <LineChart
            points={points.map((p) => ({
              v: p.v,
              label: `${mapName(p.m.map) ?? ""} · ${formatDate(p.m.date, locale) ?? ""}`,
              href: `/history?match=${encodeURIComponent(p.m.analysisId)}`,
              map: typeof p.m.map === "string" ? p.m.map : null,
            }))}
            unit={def.unit ?? ""}
            digits={def.digits}
          />
        </Panel>
      )}

      <div className="grid-2">
        <ReviewHistory reviews={data.reviews} rate={rate} />
        <LiveCalls calls={data.liveCalls} />
      </div>
      {!data.linkedToSteam && data.playerSteamId && (
        <p className="muted small">
          <User size={14} />{" "}
          {t("Tracking player {id}", { id: data.playerSteamId })}
        </p>
      )}
    </main>
  );
}
