"use client";
import Link from "next/link";
import { LiveSessionDto } from "@/shared/api-types";
import { formatDate, mapName } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { Play, Signal } from "@/shared/icons";
import { Callout } from "@/shared/ui";
import type { Simulator, SimulatorAction } from "../model/types";
/** Shown while no session is attached: last data, simulator and the setup steps. */
export function ConnectGuide({
  latest,
  sim,
  simError,
  simulate,
  onView,
}: {
  latest: LiveSessionDto | undefined;
  sim: Simulator;
  simError: string;
  simulate: (action: SimulatorAction) => Promise<void>;
  onView: (sessionId: string) => void;
}) {
  const { t, locale } = useI18n();
  return (
    <section className="connect-guide">
      <div className="notice-card">
        <Signal size={28} />
        <div>
          <strong>{t("No game connected right now")}</strong>
          <p className="muted">
            {latest && formatDate(latest.receivedAt, locale)
              ? t(
                  "The last data arrived on {date}{map}. It is not a live broadcast.",
                  {
                    date: formatDate(latest.receivedAt, locale)!,
                    map: mapName(latest.map) ? ` (${mapName(latest.map)})` : "",
                  },
                )
              : t("We have not received any game data yet.")}
          </p>
        </div>
        {sim.available && (
          <button
            className="btn btn-primary"
            type="button"
            disabled={sim.running}
            onClick={() => void simulate("start")}
          >
            <Play size={18} /> {t("Simulate a match")}
          </button>
        )}
        {latest && (
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => onView(latest.sessionId)}
          >
            {t("View last saved state")}
          </button>
        )}
      </div>
      {sim.available && (
        <p className="muted small">
          {t(
            "The simulator sends a scripted match through the real collector → API → WebSocket pipeline, exactly like CS2 would.",
          )}
        </p>
      )}
      {simError && (
        <Callout tone="error" role="alert">
          {t(simError)}
        </Callout>
      )}
      <ol className="howto">
        <li>
          <strong>{t("Create a pairing code")}</strong>
          <span>
            <Link href="/settings">{t("Settings")}</Link> →{" "}
            {t("“Pair a collector”.")}
          </span>
        </li>
        <li>
          <strong>{t("Run the collector on your gaming PC")}</strong>
          <span>
            {t("It receives CS2's data and forwards it here securely.")}
          </span>
        </li>
        <li>
          <strong>{t("Copy the integration file")}</strong>
          <span>
            <code>gamestate_integration_cs2live.cfg</code> {t("goes in")}{" "}
            <code>…\Counter-Strike Global Offensive\game\csgo\cfg</code>.
          </span>
        </li>
        <li>
          <strong>{t("Open CS2 and join a match")}</strong>
          <span>
            {t("This page connects by itself as soon as data starts arriving.")}
          </span>
        </li>
      </ol>
    </section>
  );
}
