"use client";
import { useState } from "react";
import { PlanList } from "@/features/maps";
import { BRAND, LogoMark } from "@/shared/brand";
import { formatNumber } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import {
  Chart,
  Crosshair,
  Flashbang,
  MapPin,
  Medal,
  Share,
  Skull,
  Target,
  Trend,
} from "@/shared/icons";
import { periodLabel, type Evolution, type Report } from "../model/report";
import { MatchSpotlight } from "./MatchSpotlight";
import { PerMapTable } from "./PerMapTable";
import { TrendChart } from "./TrendChart";

/** The full monthly report: hero, trends, per map, recurring mistakes, evolution, plan. */
export function ReportView({
  r,
  share = true,
}: {
  r: Report;
  share?: boolean;
}) {
  const { t, locale } = useI18n();
  const [copied, setCopied] = useState(false);
  const s = r.summary;
  const kpis = [
    { label: t("Matches"), v: formatNumber(s.matches, 0, locale) },
    {
      label: t("Win rate"),
      v: s.winRate !== null ? `${formatNumber(s.winRate, 0, locale)}%` : null,
    },
    { label: "ADR", v: formatNumber(s.adr, 1, locale) },
    { label: "K/D", v: formatNumber(s.kd, 2, locale) },
    {
      label: t("Rating"),
      v: formatNumber(
        s.rating,
        s.rating !== null && s.rating < 10 ? 2 : 0,
        locale,
      ),
    },
  ].filter((k) => k.v !== null);
  async function shareIt() {
    const url = `${window.location.origin}/reports?id=${encodeURIComponent(r.id)}`;
    const title = `${BRAND.name} · ${periodLabel(r.period, locale)}`;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* share sheet dismissed */
    }
  }
  return (
    <article className="report-doc" data-testid="report-view">
      <header className="rd-hero">
        <div className="rd-brand" aria-hidden>
          <LogoMark size={48} />
        </div>
        <div className="rd-title">
          <span className="eyebrow">
            {t("Monthly performance report")} · {BRAND.name}
          </span>
          <h2>{periodLabel(r.period, locale) || t("This month")}</h2>
          {s.headline && <p className="lead">{s.headline}</p>}
        </div>
        {share && (
          <button
            type="button"
            className="btn btn-ghost btn-sm rd-share"
            onClick={() => void shareIt()}
          >
            <Share size={16} /> {copied ? t("Link copied") : t("Share")}
          </button>
        )}
        {kpis.length > 0 && (
          <dl className="rd-kpis">
            {kpis.map((k) => (
              <div key={k.label}>
                <dt>{k.label}</dt>
                <dd className="tabular">{k.v}</dd>
              </div>
            ))}
          </dl>
        )}
      </header>

      {r.narrative.length > 0 && (
        <section className="rd-narrative">
          {r.narrative.map((p, i) => (
            <p key={i} className={i === 0 ? "lead" : ""}>
              {p}
            </p>
          ))}
          {(r.strengths.length > 0 || r.focus.length > 0) && (
            <div className="rd-story">
              <StoryList
                title={t("Strengths")}
                tone="good"
                items={r.strengths}
              />
              <StoryList title={t("Focus")} tone="warn" items={r.focus} />
            </div>
          )}
        </section>
      )}

      {r.trends.length > 0 && (
        <section className="report-sec">
          <h3 className="sec-title">
            <Trend size={20} /> {t("Trends")}
          </h3>
          <div className="trend-grid">
            {r.trends.map((s2) => (
              <TrendChart key={s2.key} s={s2} />
            ))}
          </div>
        </section>
      )}

      {(r.bestMatch || r.worstMatch) && (
        <section className="report-sec">
          <h3 className="sec-title">
            <Medal size={20} /> {t("Best and toughest match")}
          </h3>
          <div className="spotlights">
            {r.bestMatch && <MatchSpotlight kind="best" m={r.bestMatch} />}
            {r.worstMatch && <MatchSpotlight kind="worst" m={r.worstMatch} />}
          </div>
        </section>
      )}

      {r.perMap.length > 0 && (
        <section className="report-sec">
          <h3 className="sec-title">
            <MapPin size={20} /> {t("Per map")}
          </h3>
          <PerMapTable rows={r.perMap} />
        </section>
      )}

      {r.recurring.length > 0 && (
        <section className="report-sec">
          <h3 className="sec-title">
            <Skull size={20} /> {t("Recurring mistakes")}
          </h3>
          <ul className="recurring">
            {r.recurring.map((x) => (
              <li key={x.title} className={x.trend ?? ""}>
                <span className="rc-text">
                  <strong>{x.title}</strong>
                  {x.tip && <small>{x.tip}</small>}
                </span>
                {x.count !== null && (
                  <span className="chip">
                    {t("{n} matches", { n: x.count })}
                  </span>
                )}
                {x.trend && (
                  <span
                    className={`chip ${x.trend === "better" ? "good" : x.trend === "worse" ? "bad" : ""}`}
                  >
                    {x.trend === "better"
                      ? t("Improving")
                      : x.trend === "worse"
                        ? t("Getting worse")
                        : t("Steady")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <EvolutionSection
        title={t("Utility evolution")}
        icon={<Flashbang size={20} />}
        e={r.utility}
      />
      <EvolutionSection
        title={t("Crosshair evolution")}
        icon={<Crosshair size={20} />}
        e={r.crosshair}
      />

      {r.plan.length > 0 && (
        <section className="report-sec game-plan">
          <h3 className="sec-title">
            <Target size={20} /> {t("Plan for next month")}
          </h3>
          <PlanList
            items={r.plan.map((text) => ({ text, scope: "general" as const }))}
          />
        </section>
      )}
      {r.caveats.length > 0 && (
        <ul className="rd-caveats muted small">
          {r.caveats.map((c) => (
            <li key={c}>{t(c)}</li>
          ))}
        </ul>
      )}
      <footer className="rd-foot muted small">
        <Chart size={14} />{" "}
        {t("Generated by {coach} from your analyzed matches.", {
          coach: BRAND.coach,
        })}
      </footer>
    </article>
  );
}

function EvolutionSection({
  title,
  icon,
  e,
}: {
  title: string;
  icon: React.ReactNode;
  e: Evolution | null;
}) {
  if (!e) return null;
  return (
    <section className="report-sec">
      <h3 className="sec-title">
        {icon} {title}
      </h3>
      {e.summary && <p className="muted">{e.summary}</p>}
      {e.series.length > 0 && (
        <div className="trend-grid">
          {e.series.map((s) => (
            <TrendChart key={s.key} s={s} />
          ))}
        </div>
      )}
    </section>
  );
}

function StoryList({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "good" | "warn";
  items: string[];
}) {
  if (!items.length) return null;
  return (
    <div className={`rd-story-col ${tone}`}>
      <h4>{title}</h4>
      <ul>
        {items.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </div>
  );
}
