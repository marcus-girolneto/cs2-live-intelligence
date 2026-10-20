"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { ClipPlayerDialog } from "@/features/replay";
import { UsageMeter, useNow, useUpgrade, useUsage } from "@/features/billing";
import { MapBadge } from "@/features/maps";
import { BRAND } from "@/shared/brand";
import { useI18n } from "@/shared/i18n";
import { formatDate, mapName } from "@/shared/format";
import { Brain, Crosshair, Info, Upload } from "@/shared/icons";
import { Callout, EmptyState, PageHeader, PageLoader } from "@/shared/ui";
import { useCoachSession } from "../hooks/useCoachSession";
import { useMatchOwnership } from "../hooks/useMatchOwnership";
import type { ClipRef } from "../model/coaching";
import { CoachWorkspace } from "./CoachWorkspace";
import { MatchPicker } from "./MatchPicker";
import { Stepper } from "./Stepper";

/** /coach: the AI Coach screen (match → player → review type → report). */
export function CoachScreen() {
  const { t, locale } = useI18n();
  const s = useCoachSession();
  const ownership = useMatchOwnership(s.card?.matchId ?? null);
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
  const exportAllowed = isAdmin || !!limits?.clipExport;
  const step = !s.card ? 1 : !s.player ? 2 : s.running || s.review ? 4 : 3;
  const meter = usage?.aiReviews ? (
    <UsageMeter kind="aiReviews" usage={usage} now={now} compact />
  ) : undefined;
  return (
    <main className="page coach-page">
      <PageHeader
        eyebrow={BRAND.coach}
        icon={<Brain size={16} />}
        title={t("Your AI coach")}
        lead={t(
          "Pick a match and a player. The coach reviews every round and shows you the moments that matter in 2D replay.",
        )}
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
          {ownership === "external" && (
            <p className="own-banner ext" role="status">
              <Info size={16} />
              <span>
                {t("External demo: insights won't count toward your progress.")}
              </span>
            </p>
          )}
          <CoachWorkspace s={s} meter={meter} onPlay={play} />
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
