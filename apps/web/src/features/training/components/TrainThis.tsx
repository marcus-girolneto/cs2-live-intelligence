"use client";
import { useI18n } from "@/shared/i18n";
import { Dumbbell } from "@/shared/icons";
import { Skeleton } from "@/shared/ui";
import { useCatalog, useMatchTraining } from "../hooks/useTraining";
import type { OnPlay } from "../model/types";
import { TrainingPlanView } from "./TrainingPlanView";

/** "Train this" section of a coach report (quick, deep and team). Hidden when unavailable. */
export function TrainThis({
  analysisId,
  steamId,
  onPlay,
}: {
  analysisId: string | null;
  steamId: string | null;
  onPlay?: OnPlay;
}) {
  const { t } = useI18n();
  const plan = useMatchTraining(analysisId, steamId);
  const catalog = useCatalog();
  if (!analysisId || !steamId || plan.error) return null;
  return (
    <section
      className="report-sec train-this"
      aria-labelledby="train-this"
      data-testid="train-this"
    >
      <h3 className="sec-title" id="train-this">
        <Dumbbell size={20} /> {t("Train this")}
      </h3>
      <p className="muted small">
        {t(
          "Concrete practice from your own demo: maps, spots and commands. No theory.",
        )}
      </p>
      {plan.loading || !plan.data ? (
        plan.loading ? (
          <Skeleton height={180} />
        ) : null
      ) : (
        <TrainingPlanView
          plan={plan.data}
          resources={catalog.data?.resources ?? []}
          analysisId={analysisId}
          onPlay={onPlay}
        />
      )}
    </section>
  );
}
