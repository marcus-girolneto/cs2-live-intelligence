"use client";
import { useI18n } from "@/shared/i18n";
import { Coin } from "@/shared/icons";
import { CrosshairLoader } from "@/shared/ui";
import {
  formatPrice,
  perCredit,
  type CreditPack,
  type Currency,
} from "../../model/plans";

const BADGE: Record<string, string> = {
  popular: "Most popular",
  best_value: "Best value",
};

/** Grid of credit packs. `onBuy` absent → display only (pricing for signed-out visitors). */
export function CreditPacks({
  packs,
  currency,
  onBuy,
  busy = null,
  disabled = false,
  compact = false,
}: {
  packs: CreditPack[];
  currency: Currency;
  onBuy?: (pack: CreditPack) => void;
  busy?: string | null;
  disabled?: boolean;
  compact?: boolean;
}) {
  const { t, locale } = useI18n();
  return (
    <ul className={`pack-grid ${compact ? "compact" : ""}`}>
      {packs.map((p) => {
        const badge = p.badge ? (BADGE[p.badge] ?? p.badge) : null;
        return (
          <li key={p.id} className={`pack-card ${badge ? "featured" : ""}`}>
            {badge && <span className="pack-badge">{t(badge)}</span>}
            <span className="pack-coins" aria-hidden>
              <Coin size={compact ? 22 : 28} />
            </span>
            <span className="pack-amount">
              <b className="tabular">{p.credits}</b>
              <small>{t("credits")}</small>
            </span>
            <span className="pack-name">{p.name}</span>
            <span className="pack-price">
              <b>{formatPrice(p.prices[currency], currency, locale)}</b>
              <small>
                {t("{price} per credit", {
                  price: formatPrice(perCredit(p, currency), currency, locale),
                })}
              </small>
            </span>
            {onBuy && (
              <button
                type="button"
                className={`btn btn-block ${badge ? "btn-primary" : "btn-ghost"}`}
                disabled={disabled || busy !== null}
                onClick={() => onBuy(p)}
                aria-label={t("Buy {n} credits", { n: p.credits })}
              >
                {busy === p.id ? (
                  <CrosshairLoader size={18} />
                ) : (
                  <Coin size={18} />
                )}
                {t("Buy")}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
