"use client";
import { useI18n } from "@/shared/i18n";
import { Bolt, Check, Coin, Compare, Layers, Refresh } from "@/shared/icons";
import type { ReviewTier } from "../model/coaching";

const WHAT: Record<ReviewTier, string[]> = {
  quick: [
    "Verdict and overall score",
    "Scores vs the lobby",
    "Key moments with 2D clips",
    "Plan for your next match",
  ],
  deep: [
    "Everything in Quick",
    "Utility lab: grenade log, efficiency, lineups to learn",
    "Crosshair placement: pre-aim offset, duels well pre-aimed, too low or high",
    "Positioning: isolation, crossfire, danger zones",
    "Round-by-round table",
    "Up to 10 key moments",
  ],
};

/** One big "Choose your review" card: what you get, what it costs, run / open. */
export function TierCard({
  tier,
  cost,
  fullCost,
  admin,
  done,
  otherDone,
  affordable,
  disabled,
  onRun,
  onOpen,
  onBuy,
}: {
  tier: ReviewTier;
  cost: number;
  /** Price before the plan discount (Pro pays less for Deep). */
  fullCost?: number;
  admin: boolean;
  /** A stored review of this tier exists (opening it is free). */
  done: boolean;
  /** The other tier was already run: running this one unlocks Compare. */
  otherDone: boolean;
  affordable: boolean;
  disabled: boolean;
  onRun: () => void;
  onOpen: () => void;
  onBuy: () => void;
}) {
  const { t } = useI18n();
  const deep = tier === "deep";
  const Icon = deep ? Layers : Bolt;
  const name = deep ? t("Deep review") : t("Quick review");
  const credits = cost === 1 ? t("1 credit") : t("{n} credits", { n: cost });
  return (
    <article
      className={`tier-card ${tier} ${done ? "done" : ""}`}
      aria-labelledby={`tier-${tier}`}
      data-testid={`tier-${tier}`}
    >
      {deep && <span className="tier-ribbon">{t("Pro analysis")}</span>}
      <header className="tier-head">
        <span className="tier-icon" aria-hidden>
          <Icon size={26} />
        </span>
        <div>
          <h3 id={`tier-${tier}`}>{name}</h3>
          <p className="muted small">
            {deep
              ? t("Pro analysis with a stronger AI")
              : t("The essentials in under a minute")}
          </p>
        </div>
        <span
          className="tier-cost"
          aria-label={admin ? t("Free for admins") : credits}
        >
          <Coin size={18} />
          {admin ? (
            <b>{t("Free")}</b>
          ) : (
            <>
              {fullCost !== undefined && fullCost > cost && (
                <s className="muted">{fullCost}</s>
              )}
              <b className="tabular">{cost}</b>
            </>
          )}
        </span>
      </header>
      <div className="tier-badges">
        {done && (
          <span className="chip good">
            <Check size={14} /> {t("Already reviewed · opens free")}
          </span>
        )}
        {!done && otherDone && (
          <span className="chip accent">
            <Compare size={14} /> {t("Compare")}
            <span className="tier-badge-note">
              {t("Run it to compare side by side")}
            </span>
          </span>
        )}
        {fullCost !== undefined && fullCost > cost && !admin && (
          <span className="chip">{t("Pro price")}</span>
        )}
      </div>
      <ul className="tier-what">
        {WHAT[tier].map((w, i) => (
          <li key={w} className={deep && i === 0 ? "inherit" : ""}>
            <Check size={16} /> <span>{t(w)}</span>
          </li>
        ))}
      </ul>
      <footer className="tier-foot">
        {done ? (
          <>
            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={onOpen}
            >
              {t("Open my {tier}", { tier: name })}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={disabled}
              onClick={affordable ? onRun : onBuy}
            >
              <Refresh size={16} />
              {admin
                ? t("Run again")
                : t("Run again · {cost}", { cost: credits })}
            </button>
          </>
        ) : affordable ? (
          <button
            type="button"
            className={`btn btn-block btn-lg ${deep ? "btn-primary" : "btn-ghost tier-run"}`}
            disabled={disabled}
            onClick={onRun}
          >
            <Icon size={20} />
            {deep ? t("Run Deep review") : t("Run Quick review")}
            {!admin && <span className="tier-btn-cost">· {credits}</span>}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-block btn-lg btn-ghost"
            onClick={onBuy}
          >
            <Coin size={20} /> {t("Get credits for this review")}
          </button>
        )}
      </footer>
    </article>
  );
}
