"use client";
import type { ReactNode } from "react";
import { useCredits, useUpgrade, useUsage } from "@/features/billing";
import { useI18n } from "@/shared/i18n";
import { Coin } from "@/shared/icons";
import type { ReviewTier } from "../model/coaching";
import type { TierReviews } from "../hooks/usePlayerReviews";
import { TierCard } from "./TierCard";

/** Step 3, "Choose your review": Quick vs Deep, with costs, balance and what you get. */
export function TierChoice({
  playerName,
  byTier,
  meter,
  onRun,
  onOpen,
  team,
}: {
  playerName: string | null;
  byTier: TierReviews | null;
  meter?: ReactNode;
  onRun: (tier: ReviewTier) => void;
  onOpen: (tier: ReviewTier) => void;
  /** Third card: the team review (IGL view of the whole team). */
  team?: { done: boolean; onRun: () => void; onOpen: () => void };
}) {
  const { t } = useI18n();
  const { balance, cost, canAfford, isAdmin } = useCredits();
  const { plan } = useUsage();
  const { openCredits } = useUpgrade();
  const buy = (tier: ReviewTier | "team") =>
    openCredits({ needed: cost(tier), balance, tier });
  const pro = plan?.id === "pro";
  return (
    <section className="tier-choice" aria-labelledby="tier-title">
      <div className="tier-intro">
        <h2 className="step-title" id="tier-title">
          {playerName
            ? t("Choose your review for {name}", { name: playerName })
            : t("Choose the player to review")}
        </h2>
        <div className="tier-wallet">
          {isAdmin ? (
            <span className="chip accent">{t("Admin · reviews are free")}</span>
          ) : balance !== null ? (
            <>
              <span className="tw-balance">
                <Coin size={18} /> {t("Balance")}{" "}
                <b className="tabular">{balance}</b>
              </span>
              <button
                type="button"
                className="btn-link"
                onClick={() => openCredits({ balance })}
              >
                {t("Buy credits")}
              </button>
            </>
          ) : null}
          {meter}
        </div>
      </div>
      <div className="tier-grid">
        {(["quick", "deep"] as const).map((tier) => (
          <TierCard
            key={tier}
            tier={tier}
            cost={cost(tier)}
            {...(tier === "deep" && pro && cost("deep") < 3
              ? { fullCost: 3 }
              : {})}
            admin={isAdmin}
            done={!!byTier?.[tier]}
            otherDone={!!byTier?.[tier === "quick" ? "deep" : "quick"]}
            affordable={canAfford(tier)}
            disabled={!playerName || byTier === null}
            onRun={() => onRun(tier)}
            onOpen={() => onOpen(tier)}
            onBuy={() => buy(tier)}
          />
        ))}
        {team && (
          <TierCard
            tier="team"
            cost={cost("team")}
            {...(pro && cost("team") < 4 ? { fullCost: 4 } : {})}
            admin={isAdmin}
            done={team.done}
            otherDone={false}
            affordable={canAfford("team")}
            disabled={!playerName}
            onRun={team.onRun}
            onOpen={team.onOpen}
            onBuy={() => buy("team")}
          />
        )}
      </div>
      <p className="muted small tier-note">
        {t(
          "Credits are only spent when the review is written. Opening a review you already have is always free.",
        )}
      </p>
    </section>
  );
}
