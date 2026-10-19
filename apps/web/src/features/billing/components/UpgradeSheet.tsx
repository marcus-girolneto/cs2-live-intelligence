"use client";
import Link from "next/link";
import { useI18n } from "@/shared/i18n";
import { ArrowRight, Crown, Lock } from "@/shared/icons";
import { CrosshairLoader, Dialog } from "@/shared/ui";
import {
  formatPrice,
  freeMonths,
  resetsIn,
  type Currency,
  type Plan,
  type PlanLimitError,
} from "../model/plans";
import { PlanFeatures } from "./PlanFeatures";

/** Shown instead of an error when a 402 plan_limit arrives (or a locked feature is clicked). */
export function UpgradeSheet({
  info,
  target,
  currency,
  billingEnabled,
  busy,
  error,
  onCheckout,
  onClose,
}: {
  info: PlanLimitError;
  target: Plan | null;
  currency: Currency;
  billingEnabled: boolean | null;
  busy: boolean;
  error: string;
  onCheckout: (plan: Plan) => void;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const wait = resetsIn(info.resetsAt);
  const titles: Record<PlanLimitError["feature"], string> = {
    ai_review:
      info.limit === null
        ? t("You reached today's AI reviews")
        : t("You used {n} of {n} AI reviews today", { n: info.limit }),
    live_ai:
      info.limit === 0
        ? t("Live AI IGL is a Basic and Pro feature")
        : t("You reached today's live AI matches"),
    upload: t("You reached today's demo uploads"),
    clip_export: t("Export your clips as video"),
    per_map: t("Per-map deep learning is a Pro feature"),
  };
  const price = target?.prices[currency];
  return (
    <Dialog
      className="upgrade-sheet"
      title={
        <>
          <Lock size={20} /> {titles[info.feature]}
        </>
      }
      sub={
        wait
          ? t("Your free quota resets in {h}h {m}m.", { h: wait.h, m: wait.m })
          : info.feature === "clip_export"
            ? t("Share your best plays as a video with your team.")
            : info.feature === "per_map"
              ? t("The coach learns your habits on each map separately.")
              : undefined
      }
      onClose={onClose}
    >
      {target && price ? (
        <div className="upsell-card">
          <header>
            <span className="upsell-plan">
              <Crown size={20} /> {target.name}
            </span>
            <span className="upsell-price">
              <b>{formatPrice(price.month, currency, locale)}</b>
              <small>{t("/month")}</small>
            </span>
          </header>
          {freeMonths(price) > 0 && (
            <p className="muted small">
              {t("or {price}/year — {n} months free", {
                price: formatPrice(price.year, currency, locale),
                n: freeMonths(price),
              })}
            </p>
          )}
          <PlanFeatures limits={target.limits} compact />
          {error && (
            <p role="alert" className="form-error">
              {t(error)}
            </p>
          )}
          <div className="upsell-actions">
            {billingEnabled === false ? (
              <p className="soon-note" role="status">
                {t("Coming soon — payments are being set up.")}
              </p>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-lg"
                disabled={busy || billingEnabled === null}
                onClick={() => onCheckout(target)}
              >
                {busy ? <CrosshairLoader size={20} /> : <Crown size={20} />}
                {t("Upgrade to {plan}", { plan: target.name })}
              </button>
            )}
            <Link className="btn btn-ghost" href="/pricing" onClick={onClose}>
              {t("Compare plans")} <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      ) : (
        <Link className="btn btn-primary" href="/pricing" onClick={onClose}>
          {t("Compare plans")} <ArrowRight size={16} />
        </Link>
      )}
    </Dialog>
  );
}
