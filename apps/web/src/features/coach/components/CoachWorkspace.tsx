"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useUsage } from "@/features/billing";
import { useI18n } from "@/shared/i18n";
import { ArrowRight, Refresh } from "@/shared/icons";
import { Callout, Skeleton } from "@/shared/ui";
import type { CoachSession } from "../hooks/useCoachSession";
import type { ClipRef, ReviewTier } from "../model/coaching";
import { evidenceRounds } from "../model/session";
import { CoachReport } from "./CoachReport";
import { CoachRunning } from "./CoachRunning";
import { CompareView } from "./CompareView";
import { DeepSections } from "./deep/DeepSections";
import { DeepTeaser } from "./DeepTeaser";
import { PlayerPicker } from "./PlayerPicker";
import { ReelButton } from "./ReelButton";
import { ReviewToolbar } from "./ReviewToolbar";
import { TierChoice } from "./TierChoice";

/** Steps 2–4 for a chosen match: player → tier → running → report / compare. */
export function CoachWorkspace({
  s,
  meter,
  onPlay,
}: {
  s: CoachSession;
  meter?: ReactNode;
  onPlay: (clip: ClipRef, title: string) => void;
}) {
  const { t } = useI18n();
  const { isAdmin } = useUsage();
  const [compare, setCompare] = useState(false);
  const reviewId = s.review?.id;
  useEffect(() => setCompare(false), [reviewId]);
  if (!s.card) return null;
  if (s.analysisError)
    return (
      <Callout tone="error" role="alert">
        {t(s.analysisError)}
      </Callout>
    );
  if (!s.analysis) return <Skeleton height={240} />;
  if (s.running)
    return (
      <CoachRunning
        since={s.running.since}
        tier={s.running.tier}
        events={s.analysis.analysis.events?.length ?? 0}
        playerName={s.player?.name ?? ""}
      />
    );
  const has = { quick: !!s.byTier?.quick, deep: !!s.byTier?.deep };
  if (s.review && s.player) {
    const r = s.review;
    const quick = s.byTier?.quick;
    const deep = s.byTier?.deep;
    const showCompare = compare && quick && deep;
    const open = (tier: ReviewTier) => {
      setCompare(false);
      s.open(tier);
    };
    return (
      <>
        <ReviewToolbar
          current={showCompare ? "compare" : r.tier}
          has={has}
          onOpen={open}
          onCompare={() => setCompare(true)}
          onUnlockDeep={() => s.run("deep")}
          actions={
            <ReelButton
              analysisId={s.card.analysisId}
              steamId={s.player.steamId}
              playerName={s.player.name}
            />
          }
        />
        {showCompare ? (
          <CompareView
            quick={quick.coaching}
            deep={deep.coaching}
            onOpen={open}
          />
        ) : (
          <CoachReport
            review={r}
            playerName={s.player.name}
            map={s.card.map}
            matchHref={`/history?match=${encodeURIComponent(s.card.matchId)}`}
            roundsFor={(ids) => evidenceRounds(ids, s.analysis)}
            onPlay={onPlay}
            onRate={s.rate}
            onRegenerate={s.choose}
            regenerateNote={
              isAdmin
                ? null
                : t("Asking again writes a new review and uses credits.")
            }
            deepSlot={
              r.coaching.deep ? (
                <DeepSections deep={r.coaching.deep} onPlay={onPlay} />
              ) : null
            }
            tail={
              r.tier === "quick" && !has.deep ? (
                <DeepTeaser onRunDeep={() => s.run("deep")} />
              ) : null
            }
          />
        )}
      </>
    );
  }
  return (
    <section aria-label={t("Choose the player")}>
      <h2 className="step-title">{t("Who should the coach review?")}</h2>
      <PlayerPicker
        roster={s.roster}
        selected={s.player?.steamId ?? null}
        onPick={s.pickPlayer}
      />
      {s.failure && (
        <Callout
          tone={s.failure.code === "ai_not_configured" ? "warn" : "error"}
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
                onClick={() => s.run(s.failure!.tier)}
              >
                <Refresh size={16} /> {t("Try again")}
              </button>
            </div>
          )}
        </Callout>
      )}
      {s.player && (
        <TierChoice
          playerName={s.player.name}
          byTier={s.byTier}
          meter={meter}
          onRun={s.run}
          onOpen={s.open}
        />
      )}
    </section>
  );
}
