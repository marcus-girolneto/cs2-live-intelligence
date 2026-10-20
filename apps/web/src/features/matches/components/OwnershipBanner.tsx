"use client";
import { useState } from "react";
import { useI18n } from "@/shared/i18n";
import { Check, Info, User } from "@/shared/icons";
import type { Ownership } from "../model/ownership";
import type { PickedPlayer } from "./PlayerPickDialog";

/**
 * What we know about you in the open demo: found you, someone else's demo, or "is one of
 * these players you?". Shown above the analysis and right after an upload finishes.
 */
export function OwnershipBanner({
  owner,
  players,
  onMine,
  onExternal,
}: {
  owner: Ownership | undefined;
  players: PickedPlayer[];
  onMine: (p: PickedPlayer) => Promise<void>;
  onExternal: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  if (!owner) return null;
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      setAsking(false);
    } finally {
      setBusy(false);
    }
  };
  if (owner.ownership === "mine")
    return owner.playerName ? (
      <p className="own-banner mine" role="status">
        <Check size={16} />
        {t("Found you in this match as {name}.", { name: owner.playerName })}
      </p>
    ) : null;
  if (owner.ownership === "external" && !asking)
    return (
      <p className="own-banner ext" role="status">
        <Info size={16} />
        <span>
          {t("External demo: insights won't count toward your progress.")}
        </span>
        <button
          type="button"
          className="btn-link"
          onClick={() => setAsking(true)}
        >
          {t("This is my match")}
        </button>
      </p>
    );
  return (
    <div className="own-banner ask" role="group" aria-label={t("Is this you?")}>
      <p>
        <User size={16} />
        {t("We couldn't find you in this match. Is one of these players you?")}
      </p>
      <div className="own-players">
        {players.map((p) => (
          <button
            key={p.steamId}
            type="button"
            className="chip-btn"
            disabled={busy}
            onClick={() => void run(() => onMine(p))}
          >
            {p.name}
          </button>
        ))}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={busy}
          onClick={() => void run(onExternal)}
        >
          {t("It's someone else's demo")}
        </button>
      </div>
    </div>
  );
}
