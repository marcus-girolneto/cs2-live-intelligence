"use client";
import { useCallback, useRef, useState } from "react";
import { BRAND } from "@/shared/brand";
import { useI18n } from "@/shared/i18n";
import { Alert, Skull, Trophy } from "@/shared/icons";
import { CrosshairLoader, Dialog } from "@/shared/ui";
import { useReelClips } from "../hooks/useReelClips";
import type { ClipRef } from "../model/clip";
import { ClipStage } from "./ClipPlayer";

export type ReelClipRef = ClipRef & { kind: "highlight" | "mistake" };

/**
 * Match reel: highlights and mistakes of one player played back-to-back in the 2D clip
 * player; "Export video" records the whole reel as one WebM.
 */
export function ReelPlayerDialog({
  analysisId,
  clips,
  title,
  focusSteamId,
  exportAllowed,
  onUpsell,
  onClose,
}: {
  analysisId: string;
  clips: ReelClipRef[];
  title: string;
  focusSteamId?: string;
  exportAllowed: boolean;
  onUpsell: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const state = useReelClips(analysisId, clips);
  const [index, setIndex] = useState(0);
  const count = state.status === "ready" ? state.items.length : 0;
  const indexRef = useRef(index);
  indexRef.current = index;
  const next = useCallback(() => {
    if (indexRef.current >= count - 1) return false;
    setIndex(indexRef.current + 1);
    return true;
  }, [count]);
  const item =
    state.status === "ready" ? state.items[Math.min(index, count - 1)] : null;
  return (
    <Dialog
      title={title}
      sub={
        item
          ? t("Clip {i} of {n} · round {r}", {
              i: index + 1,
              n: count,
              r: item.clip.round,
            })
          : t("{n} clips", { n: clips.length })
      }
      onClose={onClose}
      className="clip-dialog reel-dialog"
    >
      {state.status === "loading" && (
        <div className="clip-loading" role="status">
          <CrosshairLoader size={44} />
          <span>
            {t("Loading the reel… {i}/{n}", {
              i: state.loaded,
              n: clips.length,
            })}
          </span>
        </div>
      )}
      {state.status === "error" && (
        <div className="clip-loading" role="alert">
          <Alert size={28} />
          <span>{t("This clip could not be loaded.")}</span>
          <small className="muted">{t(state.error)}</small>
        </div>
      )}
      {state.status === "ready" && item && (
        <>
          <ol className="reel-strip" aria-label={t("Reel clips")}>
            {state.items.map((x, i) => (
              <li key={`${x.clip.round}-${x.clip.from}-${i}`}>
                <button
                  type="button"
                  className={`reel-chip ${x.clip.kind} ${i === index ? "on" : ""}`}
                  aria-current={i === index ? "true" : undefined}
                  onClick={() => setIndex(i)}
                >
                  {x.clip.kind === "highlight" ? (
                    <Trophy size={14} />
                  ) : (
                    <Skull size={14} />
                  )}
                  <span>
                    {x.clip.label ?? t("Round {n}", { n: x.clip.round })}
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <ClipStage
            clip={item.clip}
            win={item.win}
            meta={state.meta}
            {...(focusSteamId ? { focusSteamId } : {})}
            exportAllowed={exportAllowed}
            onUpsell={onUpsell}
            onEnd={next}
            initialLoop={false}
            filename={`${BRAND.name.toLowerCase()}-match-reel.webm`}
            onExportStart={() => setIndex(0)}
          />
        </>
      )}
    </Dialog>
  );
}
