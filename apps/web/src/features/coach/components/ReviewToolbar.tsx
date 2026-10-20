"use client";
import type { ReactNode } from "react";
import { useI18n } from "@/shared/i18n";
import { Bolt, Compare, Layers, Lock, Users } from "@/shared/icons";
import type { ReviewTier } from "../model/coaching";

/** Above the report: switch Quick / Deep / Compare, plus extra actions (match reel). */
export function ReviewToolbar({
  current,
  has,
  onOpen,
  onCompare,
  onUnlockDeep,
  onTeam,
  actions,
}: {
  current: ReviewTier | "compare" | "team";
  has: Record<ReviewTier, boolean>;
  onOpen: (tier: ReviewTier) => void;
  onCompare: () => void;
  onUnlockDeep: () => void;
  /** Shown when a team review exists. */
  onTeam?: (() => void) | undefined;
  actions?: ReactNode;
}) {
  const { t } = useI18n();
  const both = has.quick && has.deep;
  return (
    <div className="review-toolbar">
      <div
        className="segmented tier-switch"
        role="group"
        aria-label={t("Review type")}
      >
        <button
          type="button"
          aria-pressed={current === "quick"}
          disabled={!has.quick}
          onClick={() => onOpen("quick")}
        >
          <Bolt size={16} /> {t("Quick")}
        </button>
        <button
          type="button"
          aria-pressed={current === "deep"}
          onClick={() => (has.deep ? onOpen("deep") : onUnlockDeep())}
        >
          {has.deep ? <Layers size={16} /> : <Lock size={16} />} {t("Deep")}
        </button>
        <button
          type="button"
          aria-pressed={current === "compare"}
          disabled={!both}
          title={both ? undefined : t("Run both reviews to compare them")}
          onClick={onCompare}
        >
          <Compare size={16} /> {t("Compare")}
        </button>
        {onTeam && (
          <button
            type="button"
            aria-pressed={current === "team"}
            onClick={onTeam}
          >
            <Users size={16} /> {t("Team")}
          </button>
        )}
      </div>
      {actions && <div className="review-actions">{actions}</div>}
    </div>
  );
}
