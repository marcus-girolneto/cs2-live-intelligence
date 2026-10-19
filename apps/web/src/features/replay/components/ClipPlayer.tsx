"use client";
import { useMemo, useRef, type KeyboardEvent } from "react";
import type { ClipRef } from "../model/clip";
import { BRAND } from "@/shared/brand";
import { useI18n } from "@/shared/i18n";
import { Alert } from "@/shared/icons";
import { CrosshairLoader, Dialog } from "@/shared/ui";
import { canExportVideo, useClipPlayer } from "../hooks/useClipPlayer";
import { useReplayClip } from "../hooks/useReplayClip";
import type { ReplayMeta, ReplayWindow } from "../model/replay";
import { ClipControls, type Exporting } from "./ClipControls";

export type ClipPlayerProps = {
  analysisId: string;
  clip: ClipRef;
  title: string;
  /** Player highlighted with the pulsing ring (defaults to the clip's own steamId). */
  focusSteamId?: string;
  /** Plan allows video export; when false the button shows an upsell. */
  exportAllowed: boolean;
  onUpsell: () => void;
  onClose: () => void;
};

/** "Cortes": a 2D tactical replay of a short window of one round, in a modal. */
export function ClipPlayerDialog(props: ClipPlayerProps) {
  const { t } = useI18n();
  const state = useReplayClip(props.analysisId, props.clip);
  return (
    <Dialog
      title={props.title}
      sub={t("Round {n} · 2D replay", { n: props.clip.round })}
      onClose={props.onClose}
      className="clip-dialog"
    >
      {state.status === "loading" && (
        <div className="clip-loading" role="status">
          <CrosshairLoader size={44} />
          <span>{t("Loading the replay…")}</span>
        </div>
      )}
      {state.status === "error" && (
        <div className="clip-loading" role="alert">
          <Alert size={28} />
          <span>{t("This clip could not be loaded.")}</span>
          <small className="muted">{t(state.error)}</small>
        </div>
      )}
      {state.status === "ready" && (
        <ClipStage {...props} meta={state.meta} win={state.win} />
      )}
    </Dialog>
  );
}

function ClipStage({
  clip,
  focusSteamId,
  exportAllowed,
  onUpsell,
  meta,
  win,
}: ClipPlayerProps & { meta: ReplayMeta; win: ReplayWindow }) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const wanted = focusSteamId ?? clip.steamId;
  const focus = useMemo(() => {
    const i = win.players.findIndex((p) => p.steamId === wanted);
    return i >= 0 ? i : null;
  }, [win.players, wanted]);
  // Key moment: the clip's own time, else its first kill (or first event) by id.
  const at = useMemo(() => {
    if (clip.at !== undefined) return clip.at;
    const ids = new Set(clip.eventIds ?? []);
    const hits = win.events.filter((e) => e.id && ids.has(e.id));
    return (hits.find((e) => e.type === "kill") ?? hits[0])?.t;
  }, [clip.at, clip.eventIds, win.events]);
  const scene = useMemo(
    () => ({
      brand: BRAND.name,
      roundLabel: t("Round {n}", { n: win.round || clip.round }),
      keyLabel: t("Key moment"),
    }),
    [t, win.round, clip.round],
  );
  const p = useClipPlayer({
    canvasRef,
    boxRef,
    meta,
    win,
    ...(at !== undefined ? { at } : {}),
    focus,
    scene,
  });
  const exporting: Exporting = !canExportVideo()
    ? { kind: "hidden" }
    : !exportAllowed
      ? { kind: "locked", onUpsell }
      : {
          kind: "ready",
          recording: p.recording,
          download: p.download,
          filename: `${BRAND.name.toLowerCase()}-round${clip.round}-${Math.round(clip.from)}s.webm`,
          onExport: p.exportClip,
        };
  function key(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "BUTTON" || tag === "A" || tag === "SELECT") return;
    if (e.key === " " || e.key === "k") {
      e.preventDefault();
      p.toggle();
    } else if (tag !== "INPUT" && e.key === "ArrowLeft") p.seek(p.t - 2);
    else if (tag !== "INPUT" && e.key === "ArrowRight") p.seek(p.t + 2);
    else if (e.key === "m" && at !== undefined) p.seek(at - 2);
  }
  return (
    <div className="clip-stage" onKeyDown={key}>
      <div
        ref={boxRef}
        className="clip-canvas"
        tabIndex={0}
        role="img"
        aria-label={t(
          "2D replay of round {n}. Space plays or pauses, arrows move 2 seconds.",
          { n: clip.round },
        )}
      >
        <canvas ref={canvasRef} onClick={p.toggle} />
        {p.recording && (
          <span className="clip-rec" role="status">
            ● {t("Recording…")}
          </span>
        )}
      </div>
      <ClipControls
        time={p.t}
        start={p.start}
        end={p.end}
        playing={p.playing}
        onToggle={p.toggle}
        onSeek={p.seek}
        speed={p.speed}
        onSpeed={p.setSpeed}
        slowmo={p.slowmo}
        onSlowmo={p.setSlowmo}
        loop={p.loop}
        onLoop={p.setLoop}
        {...(at !== undefined ? { at } : {})}
        events={win.events}
        exporting={exporting}
      />
      <ul className="clip-legend" aria-label={t("Legend")}>
        <li>
          <i className="lg-ct" /> CT
        </li>
        <li>
          <i className="lg-t" /> T
        </li>
        <li>
          <i className="lg-you" /> {t("Focus player")}
        </li>
        <li>
          <i className="lg-kill" /> {t("Kill")}
        </li>
        <li>
          <i className="lg-smoke" /> {t("Smoke")}
        </li>
        <li>
          <i className="lg-fire" /> {t("Fire")}
        </li>
      </ul>
    </div>
  );
}
