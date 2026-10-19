"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { ClipPlayerDialog } from "@/features/replay";
import {
  UsageMeter,
  remaining,
  useNow,
  useUpgrade,
  useUsage,
} from "@/features/billing";
import { MapBadge } from "@/features/maps";
import { BRAND } from "@/shared/brand";
import { useI18n } from "@/shared/i18n";
import { formatDate, mapName } from "@/shared/format";
import { ArrowRight, Brain, Crosshair, Refresh, Upload } from "@/shared/icons";
import {
  Callout,
  EmptyState,
  PageHeader,
  PageLoader,
  Skeleton,
} from "@/shared/ui";
import { useCoachSession } from "../hooks/useCoachSession";
import type { ClipRef } from "../model/coaching";
import { evidenceRounds } from "../model/session";
import { CoachReport } from "./CoachReport";
import { CoachRunning } from "./CoachRunning";
import { MatchPicker } from "./MatchPicker";
import { PlayerPicker } from "./PlayerPicker";
import { RunPanel } from "./RunPanel";
import { Stepper } from "./Stepper";

/** /coach — the AI Coach screen (match → player → review → report). */
export function CoachScreen() {
  const { t, locale } = useI18n();
  const s = useCoachSession();
  const { usage, isAdmin, limits } = useUsage();
  const now = useNow();
  const upgrade = useUpgrade();
  const [clip, setClip] = useState<{ clip: ClipRef; title: string } | null>(
    null,
  );
  const play = useCallback(
    (c: ClipRef, title: string) => setClip({ clip: c, title }),
    [],
  );
  const left = remaining(usage?.aiReviews);
  const upsellReviews = () =>
    upgrade.open({
      feature: "ai_review",
      limit: usage?.aiReviews?.limit ?? null,
      ...(usage?.resetsAt ? { resetsAt: usage.resetsAt } : {}),
    });
  const exportAllowed = isAdmin || !!limits?.clipExport;
  const step = !s.card ? 1 : s.running || s.review ? 3 : 2;
  const meter = <UsageMeter kind="aiReviews" usage={usage} now={now} />;
  return (
    <main className="page coach-page">
      <PageHeader
        eyebrow={BRAND.coach}
        icon={<Brain size={16} />}
        title={t("Your AI coach")}
        lead={t(
          "Pick a match and a player. The coach reviews every round and shows you the moments that matter — in 2D replay.",
        )}
        actions={
          usage?.aiReviews ? (
            <div className="head-usage">{meter}</div>
          ) : undefined
        }
      />
      <Stepper step={step} />
      {s.loadError && (
        <Callout tone="error" role="alert">
          {t(s.loadError)}
        </Callout>
      )}
      {s.loading ? (
        <PageLoader />
      ) : !s.card ? (
        s.cards.length ? (
          <section aria-label={t("Choose a match")}>
            <h2 className="step-title">{t("Choose a match")}</h2>
            <MatchPicker cards={s.cards} onPick={s.pickMatch} />
          </section>
        ) : (
          <EmptyState
            icon={<Crosshair size={28} />}
            title={t("No analyzed matches yet")}
            actions={
              <Link className="btn btn-primary" href="/upload">
                <Upload size={18} /> {t("Upload demo")}
              </Link>
            }
          >
            <p>
              {t(
                "Upload a demo and come back: the coach needs a match to review.",
              )}
            </p>
          </EmptyState>
        )
      ) : (
        <>
          <div className="coach-context">
            <MapBadge map={s.card.map} size={36} label={false} />
            <span className="cc-text">
              <strong>{mapName(s.card.map) ?? s.card.filename}</strong>
              <small>
                {[s.card.filename, formatDate(s.card.date, locale)]
                  .filter(Boolean)
                  .join(" · ")}
              </small>
            </span>
            {s.player && (s.review || s.running) && (
              <span className="cc-player">
                {t("Player")}: <b>{s.player.name}</b>
                {!s.running && (
                  <button
                    type="button"
                    className="btn-link"
                    onClick={() => s.pickPlayer(null)}
                  >
                    {t("Change")}
                  </button>
                )}
              </span>
            )}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => s.pickMatch(null)}
              disabled={!!s.running}
            >
              {t("Change match")}
            </button>
          </div>
          {s.analysisError ? (
            <Callout tone="error" role="alert">
              {t(s.analysisError)}
            </Callout>
          ) : !s.analysis ? (
            <Skeleton height={240} />
          ) : s.running ? (
            <CoachRunning
              since={s.running}
              events={s.analysis.analysis.events?.length ?? 0}
              playerName={s.player?.name ?? ""}
            />
          ) : s.review ? (
            <CoachReport
              review={s.review}
              playerName={s.player?.name ?? ""}
              map={s.card.map}
              matchHref={`/history?match=${encodeURIComponent(s.card.matchId)}`}
              roundsFor={(ids) => evidenceRounds(ids, s.analysis)}
              onPlay={play}
              onRate={s.rate}
              onRegenerate={() => (left === 0 ? upsellReviews() : s.run())}
              regenerateNote={
                left !== null
                  ? t("Asking again uses 1 of your daily reviews.")
                  : null
              }
            />
          ) : (
            <section aria-label={t("Choose the player")}>
              <h2 className="step-title">
                {t("Who should the coach review?")}
              </h2>
              <PlayerPicker
                roster={s.roster}
                selected={s.player?.steamId ?? null}
                onPick={s.pickPlayer}
              />
              {s.failure && (
                <Callout
                  tone={
                    s.failure.code === "ai_not_configured" ? "warn" : "error"
                  }
                  role="alert"
                  title={
                    s.failure.code === "ai_not_configured"
                      ? t("The coach is offline right now")
                      : t("The review could not be finished.")
                  }
                >
                  <p>
                    {s.failure.code === "ai_not_configured"
                      ? t("Please try again later.")
                      : t(s.failure.message)}
                  </p>
                  {s.failure.code === "ai_not_configured" && isAdmin ? (
                    <Link href="/admin">
                      {t("Open AI settings")} <ArrowRight size={14} />
                    </Link>
                  ) : (
                    <div>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={s.run}
                      >
                        <Refresh size={16} /> {t("Try again")}
                      </button>
                    </div>
                  )}
                </Callout>
              )}
              <RunPanel
                playerName={s.player?.name ?? null}
                remaining={left}
                meter={meter}
                onRun={s.run}
                onUpsell={upsellReviews}
              />
            </section>
          )}
        </>
      )}
      {clip && s.card && (
        <ClipPlayerDialog
          analysisId={s.card.analysisId}
          clip={clip.clip}
          title={clip.title}
          {...(s.player ? { focusSteamId: s.player.steamId } : {})}
          exportAllowed={exportAllowed}
          onUpsell={() => {
            setClip(null);
            upgrade.open({ feature: "clip_export", limit: 0 });
          }}
          onClose={() => setClip(null)}
        />
      )}
    </main>
  );
}
