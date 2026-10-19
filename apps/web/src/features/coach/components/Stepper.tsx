"use client";
import { useI18n } from "@/shared/i18n";
import { Check } from "@/shared/icons";

/** 1 Match · 2 Player · 3 Review type · 4 Report */
export function Stepper({ step }: { step: 1 | 2 | 3 | 4 }) {
  const { t } = useI18n();
  const steps = [t("Match"), t("Player"), t("Review type"), t("Report")];
  return (
    <ol className="stepper" aria-label={t("Steps")}>
      {steps.map((label, i) => {
        const n = i + 1;
        const state = n < step ? "done" : n === step ? "now" : "next";
        return (
          <li
            key={label}
            className={state}
            aria-current={state === "now" ? "step" : undefined}
          >
            <span className="st-n">
              {state === "done" ? <Check size={14} /> : n}
            </span>
            <span className="st-label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
