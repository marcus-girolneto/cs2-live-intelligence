"use client";
import { finite } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { Clock, Skull, Timer, Damage } from "@/shared/icons";
import { Panel } from "@/shared/ui";
import { secs } from "../../model/format";
import type { Insight } from "../../model/insight/index";
export function TimingPanel({
  insight,
  avgOpening,
  avgDeath,
  openingRecord,
}: {
  insight: Insight;
  avgOpening: number | null;
  avgDeath: number | null;
  openingRecord: { won: number; lost: number } | null;
}) {
  const { t, locale } = useI18n();
  const tm = insight.timing;
  if (!tm)
    return (
      <Panel icon={<Timer size={20} />} title={t("Timing")}>
        <p className="muted small">
          {t("Round timing needs an enriched demo analysis.")}
        </p>
      </Panel>
    );
  const open = finite(tm.avgOpeningTime);
  const diff = open !== null && avgOpening !== null ? open - avgOpening : null;
  const verdict =
    diff === null
      ? null
      : diff < -3
        ? {
            tone: "fast",
            text: t(
              "You take your opening duels early: {s}s before the match average.",
              {
                s: Math.abs(diff).toFixed(1),
              },
            ),
          }
        : diff > 3
          ? {
              tone: "slow",
              text: t(
                "You open late: {s}s after the match average. You tend to wait for info.",
                {
                  s: diff.toFixed(1),
                },
              ),
            }
          : {
              tone: "even",
              text: t("Your opening timing is in line with the match average."),
            };
  const items = [
    {
      icon: <Clock size={18} />,
      label: t("Opening duel"),
      value: secs(open, locale),
      ref: secs(avgOpening, locale),
    },
    {
      icon: <Damage size={18} />,
      label: t("First kill"),
      value: secs(finite(tm.avgFirstKillTime), locale),
    },
    {
      icon: <Skull size={18} />,
      label: t("Death"),
      value: secs(finite(tm.avgDeathTime), locale),
      ref: secs(avgDeath, locale),
    },
  ];
  return (
    <Panel
      icon={<Timer size={20} />}
      title={t("Timing")}
      sub={t("Average seconds after freeze time ends")}
    >
      <div className="timing-row">
        {items.map((i) => (
          <div key={i.label} className="timing-item">
            <span className="ti-label">
              {i.icon}
              {i.label}
            </span>
            <b>{i.value ?? "–"}</b>
            {i.ref && <small>{t("match avg {v}", { v: i.ref })}</small>}
          </div>
        ))}
        <div className="timing-item">
          <span className="ti-label">
            <Skull size={18} />
            {t("Early deaths")}
          </span>
          <b className={tm.earlyDeaths > 2 ? "bad" : undefined}>
            {tm.earlyDeaths}
          </b>
          <small>{t("in the first 20 s")}</small>
        </div>
      </div>
      {verdict && (
        <p className={`verdict ${verdict.tone}`}>
          {verdict.text}
          {openingRecord &&
            openingRecord.won + openingRecord.lost > 0 &&
            ` ${t("Opening record: {w} won, {l} lost.", {
              w: openingRecord.won,
              l: openingRecord.lost,
            })}`}
        </p>
      )}
    </Panel>
  );
}

/* -------------------------------------------------------------- utility */
