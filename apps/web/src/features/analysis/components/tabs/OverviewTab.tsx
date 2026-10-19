"use client";
import { formatNumber } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { Brain } from "@/shared/icons";
import { TabPanel } from "@/shared/ui";
import type { AnalysisVM } from "../../hooks/useAnalysisView";
import { DamageChart } from "../sections/DamageChart";
import { OverviewInsights } from "./OverviewInsights";
import { OverviewStats } from "./OverviewStats";
/** Overview tab: headline stats, insights, damage per round and verdict. */
export function OverviewTab({ vm }: { vm: AnalysisVM }) {
  const { t, locale } = useI18n();
  const num = (v: unknown, d = 0) => formatNumber(v, d, locale);
  const { setTab, refs, kills, deaths, kd, adr, rows, goRound, idBase } = vm;
  return (
    <TabPanel idBase={idBase} id="overview">
      <OverviewStats vm={vm} />
      <OverviewInsights vm={vm} />

      <DamageChart rows={rows} onRound={(r) => goRound([r])} />

      <div className="verdict-box">
        <p>
          {kills !== null && deaths !== null
            ? kd !== null
              ? t("{kills} kills for {deaths} deaths — a K/D of {kd}.", {
                  kills: num(kills)!,
                  deaths: num(deaths)!,
                  kd: num(kd, 2)!,
                })
              : t("{kills} kills without dying in the analyzed rounds.", {
                  kills: num(kills)!,
                })
            : t("Kills and deaths are incomplete in this demo.")}{" "}
          {adr !== null && refs.adr !== null
            ? t(
                adr >= refs.adr
                  ? "Dealt {adr} damage per round, above the match average ({avg})."
                  : "Dealt {adr} damage per round, below the match average ({avg}).",
                { adr: num(adr, 1)!, avg: num(refs.adr, 1)! },
              )
            : ""}
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
