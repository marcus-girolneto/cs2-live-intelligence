"use client";
import { finite } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { Play } from "@/shared/icons";
import type { Simulator, SimulatorAction } from "../model/types";
/** Connection status, data age, source and simulator controls above the HUD. */
export function LiveStatusBar({
  status,
  live,
  warn,
  age,
  hasState,
  sim,
  simulate,
}: {
  status: string;
  live: boolean;
  warn: boolean;
  age: number | null;
  hasState: boolean;
  sim: Simulator;
  simulate: (action: SimulatorAction) => Promise<void>;
}) {
  const { t } = useI18n();
  const ageSeconds = finite(age);
  return (
    <div className="statusbar">
      <span
        role="status"
        data-testid="connection-status"
        className={`status ${live ? "live" : warn ? "warning" : ""}`}
      >
        <i aria-hidden="true" />
        {t(status)}
      </span>
      <span data-testid="last-updated">
        {t("Updated:")}{" "}
        {ageSeconds === null
          ? "–"
          : t("{s}s ago", { s: (ageSeconds / 1000).toFixed(1) })}
      </span>
      <span>
        {t("Source:")}{" "}
        <strong data-testid="source">{hasState ? "GSI" : "–"}</strong>
      </span>
      {sim.running && (
        <>
          <span className="sim-pill">
            {t("Simulated match · round {n} of {total}", {
              n: sim.round ?? 0,
              total: sim.rounds ?? 0,
            })}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void simulate("stop")}
          >
            {t("Stop simulation")}
          </button>
        </>
      )}
      {sim.available && !sim.running && (
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => void simulate("start")}
        >
          <Play size={16} /> {t("Simulate a match")}
        </button>
      )}
    </div>
  );
}
