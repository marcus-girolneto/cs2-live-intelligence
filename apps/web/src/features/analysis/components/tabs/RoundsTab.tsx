"use client";
import { useI18n } from "@/shared/i18n";
import { Check } from "@/shared/icons";
import { TabPanel } from "@/shared/ui";
import type { AnalysisVM } from "../../hooks/useAnalysisView";
import { roundLines } from "../../model/plain";
import { PlainSummary } from "../plain/PlainSummary";
import { EconomyStrip } from "../sections/EconomyStrip";
import { RoundCard } from "../sections/RoundCard";
/** Rounds tab: economy strip and per-round kill feeds. */
export function RoundsTab({ vm }: { vm: AnalysisVM }) {
  const { t } = useI18n();
  const {
    names,
    focusRounds,
    setFocusRounds,
    player,
    rounds,
    rows,
    feedFor,
    bombsFor,
    idBase,
  } = vm;
  return (
    <TabPanel idBase={idBase} id="rounds">
      <PlainSummary
        lines={roundLines(
          rows.map((r) => ({
            round: r.round,
            won: r.won,
            damage: r.damage,
            kills: r.kills,
            died: r.died,
            traded: r.traded,
          })),
        )}
      />
      <EconomyStrip
        rows={rows}
        selected={focusRounds}
        onRound={(r) =>
          setFocusRounds((f) => (f.length === 1 && f[0] === r ? [] : [r]))
        }
      />
      {focusRounds.length > 0 && (
        <p className="focus-note">
          <Check size={16} />
          {t("Showing rounds {rounds}.", {
            rounds: focusRounds.join(", "),
          })}{" "}
          <button
            type="button"
            className="btn-link"
            onClick={() => setFocusRounds([])}
          >
            {t("Show all rounds")}
          </button>
        </p>
      )}
      <div className="rounds-list">
        {rounds
          .filter((r) => !focusRounds.length || focusRounds.includes(r.round))
          .map((r) => (
            <RoundCard
              key={r.round}
              round={r.round}
              winner={r.winner}
              row={rows.find((x) => x.round === r.round)}
              feed={feedFor(r.round)}
              bombs={bombsFor(r.round)}
              names={names}
              steamId={player.steamId}
              flagged={vm.flagged}
            />
          ))}
      </div>
    </TabPanel>
  );
}
