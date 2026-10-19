"use client";
import { useI18n } from "@/shared/i18n";
import { remaining, resetsIn, type Usage } from "../model/plans";

type Kind = "aiReviews" | "liveAiMatches" | "uploads";

/** "1 of 1 AI reviews used today · resets in 5h 12m", with a small bar. */
export function UsageMeter({
  kind,
  usage,
  now,
  compact = false,
}: {
  kind: Kind;
  usage: Usage | null;
  now: number;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const c = usage?.[kind];
  if (!c) return null;
  const left = remaining(c);
  const wait = resetsIn(usage?.resetsAt, now);
  const labels: Record<Kind, { used: string; unlimited: string }> = {
    aiReviews: {
      used: t("{used} of {limit} AI reviews used today", {
        used: c.used,
        limit: c.limit ?? "∞",
      }),
      unlimited: t("Unlimited AI reviews"),
    },
    liveAiMatches: {
      used: t("{used} of {limit} live AI matches used today", {
        used: c.used,
        limit: c.limit ?? "∞",
      }),
      unlimited: t("Unlimited live AI matches"),
    },
    uploads: {
      used: t("{used} of {limit} uploads used today", {
        used: c.used,
        limit: c.limit ?? "∞",
      }),
      unlimited: t("Unlimited uploads"),
    },
  };
  const pct = c.limit ? Math.min(100, (c.used / c.limit) * 100) : 0;
  const tone = left === 0 ? "bad" : left === 1 ? "warn" : "ok";
  return (
    <div
      className={`usage ${compact ? "compact" : ""} tone-${left === null ? "ok" : tone}`}
      data-testid={`usage-${kind}`}
    >
      <span className="usage-text">
        {left === null ? labels[kind].unlimited : labels[kind].used}
        {left !== null && wait && (
          <span className="muted">
            {" "}
            · {t("resets in {h}h {m}m", { h: wait.h, m: wait.m })}
          </span>
        )}
      </span>
      {left !== null && (
        <span className="usage-bar" aria-hidden>
          <i style={{ width: `${pct}%` }} />
        </span>
      )}
    </div>
  );
}
