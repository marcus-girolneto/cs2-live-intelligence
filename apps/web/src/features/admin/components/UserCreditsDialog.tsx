"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { LedgerList, type LedgerEntry } from "@/features/billing";
import { useI18n } from "@/shared/i18n";
import { Check, Coin } from "@/shared/icons";
import { Callout, CrosshairLoader, Dialog } from "@/shared/ui";
import { useAdminApi } from "../api/context";
import { parseDelta } from "../model/credits";
import { errorText } from "../model/types";

/** Admin: one player's credit ledger and a manual adjustment (with a mandatory note). */
export function UserCreditsDialog({
  userId,
  name,
  onClose,
}: {
  userId: string;
  name: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const api = useAdminApi();
  const [entries, setEntries] = useState<LedgerEntry[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [delta, setDelta] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(() => {
    setLoadError("");
    api
      .getUserLedger(userId)
      .then(setEntries)
      .catch((e: unknown) => {
        setEntries([]);
        setLoadError(errorText(e, "Request failed."));
      });
  }, [api, userId]);
  useEffect(load, [load]);
  const amount = parseDelta(delta);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (amount === undefined || !note.trim()) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.adjustCredits(userId, amount, note.trim());
      setNotice(t("Credits adjusted."));
      setDelta("");
      setNote("");
      load();
    } catch (e2) {
      setError(errorText(e2, "Request failed."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      className="adm-credits-dlg"
      title={
        <>
          <Coin size={20} /> {t("Credits of {name}", { name })}
        </>
      }
      onClose={onClose}
    >
      <form className="adm-adjust" onSubmit={(e) => void submit(e)}>
        <label>
          {t("Add or remove credits")}
          <input
            inputMode="numeric"
            placeholder="+5 / -2"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            aria-invalid={delta !== "" && amount === undefined}
          />
        </label>
        <label>
          {t("Note (shown in the player's history)")}
          <input
            value={note}
            maxLength={200}
            required
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <button
          className="btn btn-primary"
          disabled={busy || amount === undefined || !note.trim()}
        >
          {busy ? <CrosshairLoader size={18} /> : <Check size={18} />}{" "}
          {t("Apply")}
        </button>
      </form>
      {notice && (
        <Callout tone="success" role="status">
          {notice}
        </Callout>
      )}
      {error && (
        <Callout tone="error" role="alert">
          {t(error)}
        </Callout>
      )}
      <h3 className="cs-title">{t("Credit history")}</h3>
      <LedgerList entries={entries} error={loadError} onRetry={load} />
    </Dialog>
  );
}
