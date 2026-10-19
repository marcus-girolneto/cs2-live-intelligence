"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { nameMap, KillFeed, type AnalysisResult } from "@/features/analysis";
import { PlanReminder } from "@/features/maps";
import { useI18n } from "@/shared/i18n";
import {
  defaultReplayPlayer,
  pickReplayMatch,
  trackerAt,
} from "../model/replayPick";
import type { Me } from "@/shared/session";
import { Callout, PageLoader } from "@/shared/ui";
import { useLiveApi } from "../api/context";
import { liveTips, Baseline } from "../model/liveCoach";
import { buildReplay, type ReplayFrame } from "../model/replayFrames";
import { Hud } from "./Hud";
import { LiveAiCoach } from "./LiveAiCoach";
/** A stored demo replayed frame by frame through the same HUD and coach. */
export function ReplayMode({
  baseline,
  me,
}: {
  baseline: Baseline | null;
  me: Me | null;
}) {
  const { t } = useI18n();
  const api = useLiveApi();
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [steamId, setSteamId] = useState<string>("");
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState("");
  useEffect(() => {
    (async () => {
      try {
        const pick = pickReplayMatch(await api.listMatches(), me);
        if (!pick) return setError("No analyzed demo yet.");
        const r = await api.getAnalysis(pick.analysisId!);
        setResult(r);
        setSteamId(defaultReplayPlayer(r, me));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load the demo.");
      }
    })();
  }, [api, me]);
  const frames: ReplayFrame[] = useMemo(
    () => (result && steamId ? buildReplay(result.analysis, steamId) : []),
    [result, steamId],
  );
  useEffect(() => setIndex(0), [frames]);
  useEffect(() => {
    if (!playing || index >= frames.length - 1) return;
    const timer = setTimeout(() => setIndex((i) => i + 1), 900 / speed);
    return () => clearTimeout(timer);
  }, [playing, index, frames.length, speed]);
  const tracker = useMemo(() => trackerAt(frames, index), [frames, index]);
  const names = useMemo(
    () =>
      nameMap(result?.analysis.players ?? [], (n) => t("Player {n}", { n })),
    [result, t],
  );
  if (error)
    return (
      <Callout tone="info">
        {t(error)} <Link href="/upload">{t("Upload demo")}</Link>
      </Callout>
    );
  if (!result) return <PageLoader label={t("Loading analysis…")} />;
  const frame = frames[Math.min(index, frames.length - 1)];
  return (
    <>
      <div className="replay-controls">
        <label>
          {t("Player")}
          <select value={steamId} onChange={(e) => setSteamId(e.target.value)}>
            {result.analysis.players.map((p) => (
              <option key={p.steamId} value={p.steamId}>
                {names.get(p.steamId)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setPlaying((p) => !p)}
        >
          {playing ? t("Pause") : t("Play")}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setIndex(0);
            setPlaying(true);
          }}
        >
          {t("Restart")}
        </button>
        <label>
          {t("Speed")}
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
          >
            {[1, 2, 4].map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </label>
        <input
          type="range"
          aria-label={t("Replay position")}
          min={0}
          max={Math.max(0, frames.length - 1)}
          value={index}
          onChange={(e) => setIndex(Number(e.target.value))}
        />
      </div>
      <p className="muted small replay-note">
        {t(
          "Replays the demo as if it were live: the HUD, timeline and live coach react exactly as they would during a match.",
        )}
      </p>
      <Hud
        state={frame?.state ?? null}
        badge="replay"
        rounds={tracker.rounds}
        tips={liveTips(frame?.state ?? null, tracker.rounds, baseline)}
        baseline={baseline}
        ai={
          <LiveAiCoach
            state={frame?.state ?? null}
            rounds={tracker.rounds}
            baseline={baseline}
            {...(result ? { analysisId: result.id } : {})}
          />
        }
        feed={
          frame && frame.feed.length > 0 ? (
            <section className="hud-feed" aria-label={t("Kill feed")}>
              <h3>{t("Kill feed")}</h3>
              <KillFeed
                rows={frame.feed}
                names={names}
                highlight={steamId}
                world={t("World")}
              />
            </section>
          ) : undefined
        }
      />
      <PlanReminder map={frame?.state.map ?? null} />
    </>
  );
}
