"use client";
import type { ReactNode } from "react";
import { finite } from "../format";
import { useI18n } from "../i18n";
import { CountUp } from "./CountUp";

export function Stat({
  icon,
  label,
  value,
  digits = 0,
  suffix,
  sub,
  tone,
  emptyText,
  display,
}: {
  icon?: ReactNode;
  label: string;
  value: unknown;
  digits?: number;
  suffix?: string;
  sub?: ReactNode;
  tone?: "good" | "bad" | "accent" | "ct" | "t";
  emptyText?: string;
  /** Pre-formatted value (e.g. "2–0"); bypasses the count-up. */
  display?: string | null;
}) {
  const { t } = useI18n();
  const empty =
    display === null || (display === undefined && finite(value) === null);
  return (
    <div
      className={`stat ${tone ? `tone-${tone}` : ""} ${empty ? "is-empty" : ""}`}
    >
      <div className="stat-top">
        {icon && <span className="stat-icon">{icon}</span>}
        <span className="stat-label">{label}</span>
      </div>
      <strong className="stat-value">
        {empty ? (
          <span className="stat-none">{emptyText ?? t("No data")}</span>
        ) : display !== undefined ? (
          display
        ) : (
          <CountUp value={value} digits={digits} suffix={suffix ?? ""} />
        )}
      </strong>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}
