"use client";
import { finite } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { Money } from "@/shared/icons";
import { Panel } from "@/shared/ui";
import type { Insight } from "../../model/insight/index";
const BUYS = [
  { key: "pistol", label: "Pistol" },
  { key: "eco", label: "Eco" },
  { key: "force", label: "Force" },
  { key: "full", label: "Full buy" },
] as const;
export function EconomyPanel({ insight }: { insight: Insight }) {
  const { t, locale } = useI18n();
  const e = insight.economy;
  if (!e)
    return (
      <Panel icon={<Money size={20} />} title={t("Economy")}>
        <p className="muted small">
          {t("Economy data needs an enriched demo analysis.")}
        </p>
      </Panel>
    );
  const total = BUYS.reduce((n, b) => n + (e.buys[b.key] ?? 0), 0);
  const avg = finite(e.avgEquipmentValue);
  return (
    <Panel icon={<Money size={20} />} title={t("Economy")}>
      <div className="econ-head">
        <div>
          <span className="ti-label">{t("Avg. equipment")}</span>
          <b className="money">
            {avg === null ? "–" : `$${Math.round(avg).toLocaleString(locale)}`}
          </b>
        </div>
        {e.antiEcoKills !== undefined && (
          <div>
            <span className="ti-label">{t("Anti-eco kills")}</span>
            <b>{e.antiEcoKills}</b>
          </div>
        )}
      </div>
      {total > 0 && (
        <>
          <div className="buy-bar" aria-hidden>
            {BUYS.map((b) =>
              e.buys[b.key] > 0 ? (
                <i
                  key={b.key}
                  className={`buy-${b.key}`}
                  style={{ flex: e.buys[b.key] }}
                />
              ) : null,
            )}
          </div>
          <ul className="buy-legend">
            {BUYS.map((b) => (
              <li key={b.key}>
                <i className={`buy-${b.key}`} />
                {t(b.label)} <b>{e.buys[b.key] ?? 0}</b>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

/* ---------------------------------------------------------- damage chart */
