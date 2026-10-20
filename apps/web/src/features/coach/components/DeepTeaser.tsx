"use client";
import { useCredits } from "@/features/billing";
import { useI18n } from "@/shared/i18n";
import { Check, Coin, Layers, Lock } from "@/shared/icons";
import { DEEP_SAMPLE } from "../model/deepSample";
import { DeepSections } from "./deep/DeepSections";

const GAINS = [
  "Utility lab: every grenade, its result and lineups to learn",
  "Crosshair placement: how far you pre-aim from heads",
  "Positioning: isolation, crossfire and your danger zones",
  "Round-by-round table and up to 10 key moments",
];

/** Shown under a Quick review: a blurred preview of the Deep sections with an unlock CTA. */
export function DeepTeaser({ onRunDeep }: { onRunDeep: () => void }) {
  const { t } = useI18n();
  const { cost, isAdmin } = useCredits();
  const n = cost("deep");
  return (
    <section
      className="deep-teaser"
      aria-labelledby="deep-teaser-title"
      data-testid="deep-teaser"
    >
      <div className="dt-preview" aria-hidden="true" inert>
        <DeepSections deep={DEEP_SAMPLE} onPlay={() => undefined} />
      </div>
      <div className="dt-overlay">
        <div className="dt-card">
          <span className="dt-lock" aria-hidden>
            <Lock size={22} />
          </span>
          <h3 id="deep-teaser-title">{t("Get this with a Deep review")}</h3>
          <p className="muted">
            {t("A stronger AI goes through the same match in far more detail:")}
          </p>
          <ul>
            {GAINS.map((g) => (
              <li key={g}>
                <Check size={16} /> {t(g)}
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={onRunDeep}
          >
            <Layers size={20} /> {t("Run Deep review")}
            {!isAdmin && (
              <span className="tier-btn-cost">
                · <Coin size={16} /> {n}
              </span>
            )}
          </button>
          <p className="muted small">
            {t("Your Quick review stays, so you can compare both.")}
          </p>
        </div>
      </div>
    </section>
  );
}
