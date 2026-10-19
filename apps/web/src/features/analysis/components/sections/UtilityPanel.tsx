"use client";
import { useI18n } from "@/shared/i18n";
import {
  Flame,
  Flashbang,
  HeGrenade,
  Smoke,
  Eye,
  Damage,
  Molotov,
} from "@/shared/icons";
import { CountUp, Panel } from "@/shared/ui";
import type { Insight } from "../../model/insight/index";
export function UtilityPanel({ insight }: { insight: Insight }) {
  const { t, locale } = useI18n();
  const u = insight.utility;
  if (!u)
    return (
      <Panel icon={<Flashbang size={20} />} title={t("Utility")}>
        <p className="muted small">
          {t("Utility usage needs an enriched demo analysis.")}
        </p>
      </Panel>
    );
  const nades = [
    { icon: <Flashbang size={22} />, label: t("Flashes"), n: u.flashes },
    { icon: <Smoke size={22} />, label: t("Smokes"), n: u.smokes },
    { icon: <HeGrenade size={22} />, label: t("HE"), n: u.hes },
    { icon: <Molotov size={22} />, label: t("Molotovs"), n: u.molotovs },
  ];
  return (
    <Panel icon={<Flashbang size={20} />} title={t("Utility")}>
      <div className="nade-row">
        {nades.map((x) => (
          <div key={x.label} className={`nade ${x.n === 0 ? "zero" : ""}`}>
            {x.icon}
            <b>
              <CountUp value={x.n} />
            </b>
            <small>{x.label}</small>
          </div>
        ))}
      </div>
      <dl className="kv util-kv">
        <dt>
          <Eye size={15} /> {t("Enemies flashed")}
        </dt>
        <dd>
          {u.enemiesFlashed}
          {u.enemyBlindSeconds > 0 &&
            ` · ${t("{s}s blind", {
              s: u.enemyBlindSeconds.toLocaleString(locale, {
                maximumFractionDigits: 1,
              }),
            })}`}
        </dd>
        <dt>
          <Flashbang size={15} /> {t("Teammates flashed")}
        </dt>
        <dd
          className={u.teammatesFlashed > u.enemiesFlashed ? "bad" : undefined}
        >
          {u.teammatesFlashed}
        </dd>
        <dt>
          <Flame size={15} /> {t("Flash assists")}
        </dt>
        <dd>{u.flashAssists}</dd>
        <dt>
          <Damage size={15} /> {t("Utility damage")}
        </dt>
        <dd>{u.utilityDamage}</dd>
      </dl>
    </Panel>
  );
}

/* -------------------------------------------------------------- economy */
