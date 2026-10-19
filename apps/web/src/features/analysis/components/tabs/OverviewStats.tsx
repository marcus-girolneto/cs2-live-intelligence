"use client";
import { formatNumber } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import {
  Crosshair,
  Damage,
  Headshot,
  Shield,
  Skull,
  Bomb,
} from "@/shared/icons";
import { Stat } from "@/shared/ui";
import type { AnalysisVM } from "../../hooks/useAnalysisView";
import { metricValue } from "../../model/players";
/** Headline stat cards of the selected player. */
export function OverviewStats({ vm }: { vm: AnalysisVM }) {
  const { t, locale } = useI18n();
  const num = (v: unknown, d = 0) => formatNumber(v, d, locale);
  const {
    player,
    refs,
    kills,
    deaths,
    kd,
    adr,
    adrDelta,
    kast,
    hs,
    od,
    clutch,
  } = vm;
  return (
    <div className="stat-grid stagger">
      <Stat
        icon={<Crosshair />}
        label={t("Kills")}
        value={kills}
        tone="accent"
      />
      <Stat
        icon={<Skull />}
        label={t("Deaths")}
        value={deaths}
        sub={kd !== null ? t("K/D {kd}", { kd: num(kd, 2)! }) : undefined}
      />
      <Stat
        icon={<Damage />}
        label={t("Damage per round (ADR)")}
        value={adr}
        digits={1}
        sub={
          adrDelta === null
            ? undefined
            : t("{delta} vs match average", {
                delta: `${adrDelta >= 0 ? "+" : ""}${num(adrDelta, 1)}`,
              })
        }
        {...(adrDelta !== null ? { tone: adrDelta >= 0 ? "good" : "bad" } : {})}
      />
      <Stat
        icon={<Headshot />}
        label={t("Headshots")}
        value={hs}
        suffix="%"
        {...(refs.hs !== null
          ? { sub: t("Match average {avg}%", { avg: num(refs.hs)! }) }
          : {})}
      />
      <Stat
        icon={<Shield />}
        label="KAST"
        value={kast}
        suffix="%"
        {...(refs.kast !== null
          ? {
              sub: t("Match average {avg}%", {
                avg: num(refs.kast)!,
              }),
            }
          : {})}
        {...(kast !== null && refs.kast !== null
          ? { tone: kast >= refs.kast ? "good" : "bad" }
          : {})}
      />
      <Stat
        icon={<Crosshair />}
        label={t("Opening duels")}
        value={null}
        display={
          od?.complete
            ? `${num(od.numerator)}–${num(od.denominator - od.numerator)}`
            : null
        }
        {...(od?.complete && od.denominator === 0
          ? { sub: t("No opening duels") }
          : {})}
      />
      <Stat
        icon={<Shield />}
        label={t("Deaths traded")}
        value={metricValue(player, "traded-deaths")}
        suffix="%"
        emptyText={deaths === 0 ? t("No deaths") : t("No data")}
      />
      <Stat
        icon={<Bomb />}
        label={t("Clutches")}
        value={null}
        display={
          clutch?.complete
            ? `${num(clutch.numerator)}/${num(clutch.denominator)}`
            : null
        }
        {...(clutch?.complete && clutch.denominator === 0
          ? { sub: t("Never last alive") }
          : {})}
      />
    </div>
  );
}
