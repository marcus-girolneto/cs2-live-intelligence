"use client";
import { BRAND, LogoMark } from "@/shared/brand";
import { useI18n } from "@/shared/i18n";
import { Brain, Lock } from "@/shared/icons";
import type { ReactNode } from "react";

/** The "go" button before a real AI call, with today's remaining reviews. */
export function RunPanel({
  playerName,
  remaining,
  meter,
  onRun,
  onUpsell,
}: {
  playerName: string | null;
  /** null = unlimited / unknown */
  remaining: number | null;
  meter: ReactNode;
  onRun: () => void;
  onUpsell: () => void;
}) {
  const { t } = useI18n();
  const out = remaining === 0;
  return (
    <div className={`run-panel ${out ? "out" : ""}`}>
      <LogoMark size={64} animated={!out} />
      <div className="run-text">
        <h3>
          {playerName
            ? t("Ready to review {name}", { name: playerName })
            : t("Choose the player to review")}
        </h3>
        <p className="muted">
          {t(
            "{coach} reads every event of the match and writes a review just for this player.",
            {
              coach: BRAND.coach,
            },
          )}
        </p>
        {meter}
        {remaining !== null && remaining > 0 && (
          <p className="run-left">
            {remaining === 1
              ? t("You have 1 review left today.")
              : t("You have {n} reviews left today.", { n: remaining })}
          </p>
        )}
      </div>
      {out ? (
        <button
          type="button"
          className="btn btn-primary btn-lg"
          onClick={onUpsell}
        >
          <Lock size={20} /> {t("Get more reviews")}
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-primary btn-lg"
          disabled={!playerName}
          onClick={onRun}
        >
          <Brain size={20} /> {t("Run my review")}
        </button>
      )}
    </div>
  );
}
