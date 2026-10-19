"use client";
import { useState } from "react";
import { useI18n } from "@/shared/i18n";
import { Check, Clock, Dumbbell } from "@/shared/icons";
import { mapLabel } from "@/features/maps";
import type { Drill } from "../model/coaching";

/** Practice drills as a checklist (ticks are local to this visit). */
export function DrillChecklist({
  drills,
  map,
}: {
  drills: Drill[];
  map: string | null;
}) {
  const { t } = useI18n();
  const [done, setDone] = useState<Set<number>>(new Set());
  if (!drills.length) return null;
  const total = drills.reduce((s, d) => s + (d.durationMinutes ?? 0), 0);
  return (
    <div className="drills">
      {total > 0 && (
        <p className="muted small">
          <Clock size={14} /> {t("About {n} minutes in total", { n: total })} ·{" "}
          {t("{done} of {n} done", { done: done.size, n: drills.length })}
        </p>
      )}
      <ul className="drill-list">
        {drills.map((d, i) => {
          const on = done.has(i);
          return (
            <li key={i} className={on ? "done" : ""}>
              <label className="drill">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() =>
                    setDone((s) => {
                      const n = new Set(s);
                      if (n.has(i)) n.delete(i);
                      else n.add(i);
                      return n;
                    })
                  }
                />
                <span className="drill-box" aria-hidden>
                  {on ? <Check size={16} /> : <Dumbbell size={16} />}
                </span>
                <span className="drill-body">
                  <span className="drill-top">
                    <strong>{d.name}</strong>
                    {d.durationMinutes !== null && (
                      <span className="chip">
                        {t("{n} min", { n: d.durationMinutes })}
                      </span>
                    )}
                    <span
                      className={`chip ${d.scope === "map" ? "accent" : ""}`}
                    >
                      {d.scope === "map"
                        ? (mapLabel(map) ?? t("Map"))
                        : t("All maps")}
                    </span>
                  </span>
                  {d.howTo && <span className="drill-how">{d.howTo}</span>}
                  {d.metric && (
                    <span className="drill-metric">
                      {t("Goal")}: {d.metric}
                    </span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
