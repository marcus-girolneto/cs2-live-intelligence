"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { mapName } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { Monitor, Play, Signal } from "@/shared/icons";
import { loadMe, type Me } from "@/shared/session";
import { PageHeader } from "@/shared/ui";
import { baselineFrom } from "../model/liveCoach";
import { LiveMode } from "./LiveMode";
import { ReplayMode } from "./ReplayMode";
/** /live: the second screen (live game HUD or a demo replayed as if live). */
export function LiveScreen() {
  const { t } = useI18n();
  const [mode, setMode] = useState<"live" | "replay">("live");
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => setMe(loadMe()), []);
  const baseline = useMemo(
    () =>
      me
        ? baselineFrom(
            `${me.name ?? "demo"}${me.map ? ` · ${mapName(me.map)}` : ""}`,
            me.kills,
            me.deaths,
            me.rounds,
          )
        : null,
    [me],
  );
  const hudRef = useRef<HTMLDivElement>(null);
  async function fullscreen() {
    try {
      await hudRef.current?.requestFullscreen();
      await (
        navigator as Navigator & {
          wakeLock?: { request: (t: "screen") => Promise<unknown> };
        }
      ).wakeLock?.request("screen");
    } catch {
      /* Fullscreen or wake lock not permitted; the page still works. */
    }
  }
  return (
    <main className="page">
      <PageHeader
        eyebrow={t("Second screen")}
        icon={<Monitor size={16} />}
        title={t("Second screen")}
        lead={t(
          "Put this page on a phone, tablet or second monitor while you play. It mirrors your own game state and coaches you between rounds.",
        )}
        actions={
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void fullscreen()}
          >
            <Monitor size={18} /> {t("Full screen")}
          </button>
        }
      />
      <div
        className="mode-switch segmented"
        role="tablist"
        aria-label={t("Mode")}
      >
        <button
          role="tab"
          type="button"
          aria-selected={mode === "live"}
          onClick={() => setMode("live")}
        >
          <Signal size={16} /> {t("Live game")}
        </button>
        <button
          role="tab"
          type="button"
          aria-selected={mode === "replay"}
          onClick={() => setMode("replay")}
        >
          <Play size={16} /> {t("Replay a demo")}
        </button>
      </div>
      <div ref={hudRef} className="hud-wrap">
        {mode === "live" ? (
          <LiveMode baseline={baseline} />
        ) : (
          <ReplayMode baseline={baseline} me={me} />
        )}
      </div>
    </main>
  );
}
