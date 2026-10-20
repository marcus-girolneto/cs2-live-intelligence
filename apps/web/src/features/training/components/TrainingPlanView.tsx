"use client";
import { useI18n } from "@/shared/i18n";
import { mapName, placeName } from "@/shared/format";
import { Brain, Timer } from "@/shared/icons";
import { mindsetCopy, roleLabel, skillLabel } from "../model/copy";
import type { OnPlay, Plan, Resource } from "../model/types";
import { PracticeServerBox } from "./PracticeServerBox";
import { SessionCard } from "./SessionCard";

/** A plan rendered: context line, mindset cue, sessions in order and the practice server. */
export function TrainingPlanView({
  plan,
  resources,
  analysisId,
  onPlay,
}: {
  plan: Plan;
  resources: Resource[];
  analysisId: string | null;
  onPlay?: OnPlay;
}) {
  const { t } = useI18n();
  const total = plan.sessions.reduce((s, x) => s + x.minutes, 0);
  const context = [
    plan.map ? (mapName(plan.map) ?? plan.map) : null,
    plan.side,
    plan.area ? (placeName(plan.area) ?? plan.area) : null,
    roleLabel(plan.role, t),
  ].filter(Boolean);
  return (
    <div className="tr-plan">
      <div className="tr-plan-head">
        <span className="chip accent">{t("Pro-team session")}</span>
        <span className="tr-mins">
          <Timer size={12} /> {t("{n} min total", { n: total })}
        </span>
        {context.length > 0 && (
          <span className="muted small">{context.join(" · ")}</span>
        )}
      </div>
      {plan.focus.length > 0 && (
        <p className="tr-focus small">
          {t("Focus:")} {plan.focus.map((s) => skillLabel(s, t)).join(", ")}
        </p>
      )}
      <p className="tr-mindset">
        <Brain size={16} /> {mindsetCopy(plan.mindsetCode, plan.mindset, t)}
      </p>
      <ol className="tr-sessions">
        {plan.sessions.map((s, i) => (
          <SessionCard
            key={s.id}
            s={s}
            index={i}
            resources={resources}
            onPlay={onPlay}
          />
        ))}
      </ol>
      <PracticeServerBox plan={plan} analysisId={analysisId} />
    </div>
  );
}
