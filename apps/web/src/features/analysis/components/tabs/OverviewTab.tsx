"use client";
import { useI18n } from "@/shared/i18n";
import { Brain } from "@/shared/icons";
import { TabPanel } from "@/shared/ui";
import type { AnalysisVM } from "../../hooks/useAnalysisView";
import { metricValue } from "../../model/players";
import { overviewLines } from "../../model/plain";
import { KeyStats } from "../plain/KeyStats";
import { PlainSummary } from "../plain/PlainSummary";
import { DamageChart } from "../sections/DamageChart";
import { OverviewInsights } from "./OverviewInsights";
import { OverviewStats } from "./OverviewStats";
/** Overview tab: headline stats, insights, damage per round and verdict. */
export function OverviewTab({ vm }: { vm: AnalysisVM }) {
  const { t } = useI18n();
  const { setTab, refs, deaths, kd, adr, kast, hs, rows, goRound } = vm;
  const { idBase, player, openingRecord } = vm;
  return (
    <TabPanel idBase={idBase} id="overview">
      <PlainSummary
        lines={overviewLines({
          adr,
          adrRef: refs.adr,
          deaths,
          tradedPct: metricValue(player, "traded-deaths"),
          openingWon: openingRecord?.won ?? null,
          openingLost: openingRecord?.lost ?? null,
        })}
      />
      <KeyStats
        stats={[
          {
            id: "adr",
            term: "adr",
            label: "Damage per round",
            value: adr,
            lobby: refs.adr,
            digits: 0,
            unit: "",
            explain: "How much damage you deal each round. 100 = one kill.",
          },
          {
            id: "kd",
            term: "kd",
            label: "K/D",
            value: kd,
            lobby: refs.kd,
            digits: 2,
            unit: "",
            explain: "Kills for every death. Above 1.0 is positive.",
          },
          {
            id: "kast",
            term: "kast",
            label: "KAST",
            value: kast,
            lobby: refs.kast,
            digits: 0,
            unit: "%",
            explain:
              "Rounds where you helped: a kill, assist, survival or trade.",
          },
          {
            id: "hs",
            term: "hs",
            label: "Headshot kills",
            value: hs,
            lobby: refs.hs,
            digits: 0,
            unit: "%",
            explain: "Share of your kills that were headshots.",
          },
        ]}
      />

      <DamageChart rows={rows} onRound={(r) => goRound([r])} />

      <details className="all-stats">
        <summary>{t("Show all stats")}</summary>
        <OverviewStats vm={vm} />
        <OverviewInsights vm={vm} />
      </details>

      <div className="verdict-box">
        <p>
          {t(
            "Want to know what to change? The AI Coach turns these numbers into three fixes and a plan for your next match.",
          )}
        </p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setTab("coach")}
        >
          <Brain size={18} /> {t("Open the AI Coach review")}
        </button>
      </div>
    </TabPanel>
  );
}
