"use client";
import { useI18n } from "@/shared/i18n";
import {
  Download,
  Film,
  Hourglass,
  Lock,
  Loop,
  Pause,
  Play,
  Target,
} from "@/shared/icons";
import { playbackSpeeds, type ReplayEvent } from "../model/replay";

const fmt = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export type Exporting =
  | { kind: "hidden" }
  | { kind: "locked"; onUpsell: () => void }
  | {
      kind: "ready";
      recording: boolean;
      download: string | null;
      filename: string;
      onExport: () => void;
    };

/** Transport bar: play/pause, timeline with event ticks, speed, slow-mo, loop, export. */
export function ClipControls({
  time,
  start,
  end,
  playing,
  onToggle,
  onSeek,
  speed,
  onSpeed,
  slowmo,
  onSlowmo,
  loop,
  onLoop,
  at,
  events,
  exporting,
}: {
  time: number;
  start: number;
  end: number;
  playing: boolean;
  onToggle: () => void;
  onSeek: (t: number) => void;
  speed: number;
  onSpeed: (s: number) => void;
  slowmo: boolean;
  onSlowmo: (v: boolean) => void;
  loop: boolean;
  onLoop: (v: boolean) => void;
  at?: number;
  events: ReplayEvent[];
  exporting: Exporting;
}) {
  const { t } = useI18n();
  const span = Math.max(0.1, end - start);
  const pct = (x: number) => `${((x - start) / span) * 100}%`;
  const ticks = events.filter(
    (e) =>
      (e.type === "kill" || e.type === "grenade" || e.type === "bomb") &&
      e.t >= start &&
      e.t <= end,
  );
  return (
    <div className="clip-controls">
      <div className="clip-timeline">
        <span className="clip-time" aria-hidden>
          {fmt(time - start)}
        </span>
        <div className="clip-track">
          <div className="clip-ticks" aria-hidden>
            {ticks.map((e, i) => (
              <i
                key={i}
                className={`tick tick-${e.type} ${e.headshot ? "hs" : ""}`}
                style={{ left: pct(e.t) }}
                title={e.type}
              />
            ))}
            {at !== undefined && (
              <i className="tick tick-key" style={{ left: pct(at) }} />
            )}
          </div>
          <input
            type="range"
            min={start}
            max={end}
            step={0.05}
            value={Math.min(end, Math.max(start, time))}
            aria-label={t("Clip position")}
            aria-valuetext={`${fmt(time - start)} / ${fmt(span)}`}
            onChange={(e) => onSeek(Number(e.target.value))}
            style={{ ["--p" as string]: pct(time) }}
          />
        </div>
        <span className="clip-time" aria-hidden>
          {fmt(span)}
        </span>
      </div>
      <div className="clip-buttons">
        <button
          type="button"
          className="btn btn-primary btn-sm clip-play"
          onClick={onToggle}
          aria-label={playing ? t("Pause") : t("Play")}
        >
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        {at !== undefined && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onSeek(Math.max(start, at - 2))}
          >
            <Target size={16} /> {t("Jump to moment")}
          </button>
        )}
        <div
          className="segmented clip-speed"
          role="group"
          aria-label={t("Speed")}
        >
          {playbackSpeeds.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={speed === s}
              onClick={() => onSpeed(s)}
            >
              {s}×
            </button>
          ))}
        </div>
        {at !== undefined && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-pressed={slowmo}
            onClick={() => onSlowmo(!slowmo)}
          >
            <Hourglass size={16} /> {t("Slow-mo")}
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          aria-pressed={loop}
          onClick={() => onLoop(!loop)}
        >
          <Loop size={16} /> {t("Loop")}
        </button>
        {exporting.kind === "locked" && (
          <button
            type="button"
            className="btn btn-ghost btn-sm clip-export locked"
            onClick={exporting.onUpsell}
          >
            <Lock size={16} /> {t("Export video")}
          </button>
        )}
        {exporting.kind === "ready" &&
          (exporting.download ? (
            <a
              className="btn btn-primary btn-sm clip-export"
              href={exporting.download}
              download={exporting.filename}
            >
              <Download size={16} /> {t("Download .webm")}
            </a>
          ) : (
            <button
              type="button"
              className="btn btn-ghost btn-sm clip-export"
              disabled={exporting.recording}
              onClick={exporting.onExport}
            >
              <Film size={16} />{" "}
              {exporting.recording ? t("Recording…") : t("Export video")}
            </button>
          ))}
      </div>
    </div>
  );
}
