"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/shared/i18n";
import { User } from "@/shared/icons";
import { Callout, Dialog, Skeleton } from "@/shared/ui";
import { useMatchesApi } from "../api/context";

export type PickedPlayer = { steamId: string; name: string };

/** "Which player are you in this match?": players read from the analysis. */
export function PlayerPickDialog({
  analysisId,
  players: given,
  onPick,
  onExternal,
  onClose,
}: {
  analysisId: string | null;
  /** Players already loaded (skips the request). */
  players?: PickedPlayer[];
  onPick: (p: PickedPlayer) => Promise<void>;
  onExternal: () => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const api = useMatchesApi();
  const [players, setPlayers] = useState<PickedPlayer[] | null>(given ?? null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (given || !analysisId) return;
    api
      .getAnalysis(analysisId)
      .then((r) =>
        setPlayers(
          r.analysis.players
            .filter((p) => p.steamId)
            .map((p) => ({ steamId: p.steamId, name: p.name || p.steamId })),
        ),
      )
      .catch(() => setError("Could not load the players of this match."));
  }, [api, analysisId, given]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={t("Which player are you in this match?")}
      sub={t("Only your own matches count toward your progress.")}
      onClose={onClose}
      className="player-pick"
    >
      {error && (
        <Callout tone="error" role="alert">
          {t(error)}
        </Callout>
      )}
      {!players && !error ? (
        <Skeleton height={160} />
      ) : (
        <ul className="pick-list">
          {(players ?? []).map((p) => (
            <li key={p.steamId}>
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(() => onPick(p))}
              >
                <User size={16} /> {p.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        disabled={busy}
        onClick={() => void run(onExternal)}
      >
        {t("It's someone else's demo")}
      </button>
    </Dialog>
  );
}
