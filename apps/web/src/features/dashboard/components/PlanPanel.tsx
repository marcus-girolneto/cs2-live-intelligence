"use client";
import Link from "next/link";
import { UsageMeter, useNow, useUsage } from "@/features/billing";
import { type Progress, MapPlanPanel } from "@/features/maps";
import { useI18n } from "@/shared/i18n";
import { ArrowRight, Brain } from "@/shared/icons";
import { Panel, Skeleton } from "@/shared/ui";
/** The coach's plan for the next match (and the AI review quota). */
export function PlanPanel({
  progress,
  progressFailed,
  hasPlan,
  review,
}: {
  progress: Progress | null;
  progressFailed: boolean;
  hasPlan: boolean;
  review: boolean;
}) {
  const { t } = useI18n();
  const { usage } = useUsage();
  const now = useNow();
  return (
    <Panel
      icon={<Brain size={20} />}
      title={t("Coach's plan")}
      sub={review ? t("From your latest AI review") : undefined}
    >
      {usage?.aiReviews && (
        <UsageMeter kind="aiReviews" usage={usage} now={now} compact />
      )}
      {!progress && !progressFailed ? (
        <Skeleton lines={3} />
      ) : progress && hasPlan ? (
        <>
          <MapPlanPanel progress={progress} />
          <Link className="btn btn-ghost btn-sm" href="/coach">
            {t("Open the coach")} <ArrowRight size={16} />
          </Link>
        </>
      ) : (
        <p className="muted small">
          {t(
            "Open the AI Coach and review a match: your plan for the next match shows up here.",
          )}
        </p>
      )}
    </Panel>
  );
}
