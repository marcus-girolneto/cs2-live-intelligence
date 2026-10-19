"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SteamIdentity } from "@/features/auth";
import { CreditsPanel, WelcomeCredits } from "@/features/billing";
import {
  type Progress,
  generalPlanOf,
  mapsOf,
  useMapsApi,
} from "@/features/maps";
import { type MatchSummary, useMatchesApi } from "@/features/matches";
import { PersonalCoachCard } from "@/features/personal";
import type { MatchDto } from "@/shared/api-types";
import { BRAND } from "@/shared/brand";
import { finite } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { Brain, Monitor, Upload } from "@/shared/icons";
import { useAccount, displayName } from "@/shared/session";
import { PageHeader } from "@/shared/ui";
import { FormPanel } from "./FormPanel";
import { LatestMatches } from "./LatestMatches";
import { Onboarding } from "./Onboarding";
import { PlanPanel } from "./PlanPanel";
import { QuickActions } from "./QuickActions";
/** / (signed in): identity, latest matches, form, coach plan and next actions. */
export function DashboardScreen() {
  const { t } = useI18n();
  const { account } = useAccount();
  const [matches, setMatches] = useState<MatchDto[] | null>(null);
  const matchesApi = useMatchesApi();
  const maps = useMapsApi();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [progressFailed, setProgressFailed] = useState(false);
  useEffect(() => {
    matchesApi
      .listMatches()
      .then(setMatches)
      .catch(() => setMatches([]));
    maps
      .getProgress()
      .then(setProgress)
      .catch(() => setProgressFailed(true));
  }, [matchesApi, maps]);
  const summaries = useMemo(() => {
    const m = new Map<string, MatchSummary>();
    for (const e of progress?.timeline ?? [])
      m.set(e.analysisId, {
        map: typeof e.map === "string" ? e.map : null,
        adr: finite(e.adr),
        kills: finite(e.kills),
        deaths: finite(e.deaths),
      });
    return m;
  }, [progress]);
  if (!account) return null;
  const firstTime = matches !== null && matches.length === 0;
  const name = displayName(account, t("Local account"));
  const latest = [...(matches ?? [])]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 5);
  const review = progress?.reviews[0];
  const hasPlan =
    generalPlanOf(progress).length > 0 ||
    mapsOf(progress).some((m) => m.openPlanItems.length > 0);
  return (
    <main className="page dashboard">
      <PageHeader
        eyebrow={t("Dashboard")}
        title={
          firstTime
            ? t("Welcome, {name}", { name })
            : t("Welcome back, {name}", { name })
        }
        lead={t(
          "Your matches, your form and your coach's plan — all in one place.",
        )}
        actions={
          firstTime ? undefined : (
            <>
              <Link className="btn btn-primary" href="/coach">
                <Brain size={18} /> {BRAND.coach}
              </Link>
              <Link className="btn btn-ghost" href="/upload">
                <Upload size={18} /> {t("Upload demo")}
              </Link>
              <Link className="btn btn-ghost" href="/live">
                <Monitor size={18} /> {t("Second screen")}
              </Link>
            </>
          )
        }
      />
      <SteamIdentity account={account} />
      <WelcomeCredits variant="banner" />

      {firstTime ? (
        <Onboarding />
      ) : (
        <div className="dash-grid">
          <div className="dash-main">
            <LatestMatches
              matches={matches}
              latest={latest}
              summaries={summaries}
            />
            <PersonalCoachCard matches={matches?.length ?? null} />
            <QuickActions />
          </div>

          <div className="dash-side">
            <CreditsPanel />
            <FormPanel progress={progress} progressFailed={progressFailed} />
            <PlanPanel
              progress={progress}
              progressFailed={progressFailed}
              hasPlan={hasPlan}
              review={!!review}
            />
          </div>
        </div>
      )}
    </main>
  );
}
