"use client";
import { useLocalStorage } from "@/shared/hooks";
import { useI18n } from "@/shared/i18n";
import { Dumbbell, Timer } from "@/shared/icons";
import type { ProgramWeek } from "../model/personal";

const parseIds = (raw: string) => {
  const v: unknown = JSON.parse(raw);
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string")
    : null;
};

/** Week-by-week program; drills can be ticked off (remembered on this device). */
export function WeeklyProgram({
  weeks,
  planKey,
}: {
  weeks: ProgramWeek[];
  planKey: string;
}) {
  const { t } = useI18n();
  const [done, setDone] = useLocalStorage<string[]>(
    `fragmind.personal.${planKey}`,
    [],
    parseIds,
  );
  if (!weeks.length) return null;
  const total = weeks.reduce((s, w) => s + w.drills.length, 0);
  const ticked = weeks.reduce(
    (s, w) => s + w.drills.filter((d) => done.includes(d.id)).length,
    0,
  );
  const toggle = (id: string) =>
    setDone(done.includes(id) ? done.filter((x) => x !== id) : [...done, id]);
  return (
    <section className="report-sec" aria-labelledby="pc-program">
      <h2 className="sec-title" id="pc-program">
        <Dumbbell size={18} /> {t("Training program")}
        {total > 0 && (
          <span className="pc-done-count">
            {t("{done} of {total} drills done", { done: ticked, total })}
          </span>
        )}
      </h2>
      <ol className="pc-weeks">
        {weeks.map((w) => (
          <li key={w.week} className="pc-week">
            <h3>
              <span>{t("Week {n}", { n: w.week })}</span>
            </h3>
            {w.goals.length > 0 && (
              <ul className="pc-goals">
                {w.goals.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            )}
            {w.drills.length > 0 && (
              <ul className="pc-drills">
                {w.drills.map((d) => {
                  const on = done.includes(d.id);
                  return (
                    <li key={d.id} className={on ? "done" : ""}>
                      <label>
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggle(d.id)}
                        />
                        <span className="pc-drill-name">{d.name}</span>
                        {d.minutesPerDay !== null && (
                          <span className="pc-mins">
                            <Timer size={12} />{" "}
                            {t("{n} min/day", { n: d.minutesPerDay })}
                          </span>
                        )}
                      </label>
                      {d.howTo && <p>{d.howTo}</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
