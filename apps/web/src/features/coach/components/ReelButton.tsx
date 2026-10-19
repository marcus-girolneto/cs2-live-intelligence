"use client";
import { useState } from "react";
import { useUpgrade, useUsage } from "@/features/billing";
import { ReelPlayerDialog, type ReelClipRef } from "@/features/replay";
import { useI18n } from "@/shared/i18n";
import { Film, Lock } from "@/shared/icons";
import { CrosshairLoader } from "@/shared/ui";
import { useCoachApi } from "../api/context";

/** "Match reel" (Pro): highlights + mistakes of one player, back to back, exportable. */
export function ReelButton({
  analysisId,
  steamId,
  playerName,
  className = "btn btn-ghost btn-sm",
}: {
  analysisId: string;
  steamId: string;
  playerName: string;
  className?: string;
}) {
  const { t } = useI18n();
  const api = useCoachApi();
  const upgrade = useUpgrade();
  const { limits, isAdmin } = useUsage();
  const allowed = isAdmin || !!limits?.matchReel;
  const [busy, setBusy] = useState(false);
  const [clips, setClips] = useState<ReelClipRef[] | null>(null);
  const [note, setNote] = useState("");
  async function open() {
    if (!allowed) {
      upgrade.open({ feature: "match_reel", limit: 0 });
      return;
    }
    setBusy(true);
    setNote("");
    try {
      const list = await api.getReel(analysisId, steamId);
      if (list.length) setClips(list);
      else setNote(t("No clips for a reel in this match yet."));
    } catch (e) {
      if (!upgrade.handle(e))
        setNote(e instanceof Error ? t(e.message) : t("Request failed."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        type="button"
        className={`${className} reel-btn`}
        disabled={busy}
        onClick={() => void open()}
        data-testid="reel-button"
      >
        {busy ? (
          <CrosshairLoader size={16} />
        ) : allowed ? (
          <Film size={16} />
        ) : (
          <Lock size={16} />
        )}
        {t("Match reel")}
        {!allowed && <span className="pro-tag">Pro</span>}
      </button>
      {note && (
        <span className="small muted" role="status">
          {note}
        </span>
      )}
      {clips && (
        <ReelPlayerDialog
          analysisId={analysisId}
          clips={clips}
          title={t("Match reel · {name}", { name: playerName })}
          focusSteamId={steamId}
          exportAllowed={allowed}
          onUpsell={() => upgrade.open({ feature: "clip_export", limit: 0 })}
          onClose={() => setClips(null)}
        />
      )}
    </>
  );
}
