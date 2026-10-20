"use client";
import type { ReactNode } from "react";
import { formatNumber } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { Alert, Check, Close, Info } from "@/shared/icons";
import {
  JOURNEY_METRICS,
  type Adherence,
  type AdherenceStatus,
  type JourneyMetric,
} from "../model/journey";
import { METRIC_INFO } from "../model/metricInfo";

const STATUS: Record<AdherenceStatus, { label: string; icon: ReactNode }> = {
  applied: { label: "Applied", icon: <Check size={14} /> },
  partly: { label: "Partly", icon: <Alert size={14} /> },
  not_applied: { label: "Not applied", icon: <Close size={14} /> },
  unknown: { label: "Not enough data", icon: <Info size={14} /> },
};

const isMetric = (m: string | null): m is JourneyMetric =>
  !!m && (JOURNEY_METRICS as readonly string[]).includes(m);

/** "Did you apply it?" — each previous plan item checked on this match. */
export function AdherenceConnector({ items }: { items: Adherence[] }) {
  const { t, locale } = useI18n();
  if (!items.length) return null;
  return (
    <div className="adh-connector">
      <p className="adh-q">{t("Did you apply it?")}</p>
      <ul>
        {items.map((a) => {
          const info = isMetric(a.metric) ? METRIC_INFO[a.metric] : null;
          const fmt = (v: number) =>
            `${formatNumber(v, info?.digits ?? 0, locale) ?? "–"}${info?.unit ?? ""}`;
          const s = STATUS[a.status];
          return (
            <li key={a.planItemId} className={`adh-item ${a.status}`}>
              <span className="adh-status">
                {s.icon} {t(s.label)}
              </span>
              <span className="adh-text">{a.text}</span>
              {a.before !== null && a.after !== null && (
                <span className="adh-metric">
                  {info ? `${t(info.label)} ` : ""}
                  {fmt(a.before)} → {fmt(a.after)}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
