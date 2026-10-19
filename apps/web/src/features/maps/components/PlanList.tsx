"use client";
import type { PlanItem } from "../model/plan";

/** Numbered plan items (the shared look of every "plan for your next match"). */
export function PlanList({
  items,
  compact = false,
  start = 1,
}: {
  items: PlanItem[];
  compact?: boolean;
  start?: number;
}) {
  if (!items.length) return null;
  return (
    <ol className={`plan-list ${compact ? "compact" : ""}`}>
      {items.map((p, i) => (
        <li key={`${p.text}-${i}`}>
          <span className="plan-n">{i + start}</span>
          <span>{p.text}</span>
        </li>
      ))}
    </ol>
  );
}
