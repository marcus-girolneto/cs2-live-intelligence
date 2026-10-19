"use client";
import type { FormEvent } from "react";
import { useI18n } from "@/shared/i18n";
/** Advanced: connect to (or disconnect from) a specific session id. */
export function SessionForm({
  sessionId,
  setSessionId,
  connected,
  onSubmit,
  onDisconnect,
}: {
  sessionId: string;
  setSessionId: (id: string) => void;
  connected: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDisconnect: () => void;
}) {
  const { t } = useI18n();
  return (
    <details className="more">
      <summary>{t("Advanced: connect to a specific session")}</summary>
      <form className="inline-form" onSubmit={onSubmit}>
        <label>
          {t("Session ID")}
          <input
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            required
            maxLength={128}
          />
        </label>
        <button className="btn btn-ghost" type="submit">
          {t("Connect")}
        </button>
        {connected && (
          <button
            className="btn btn-ghost"
            type="button"
            onClick={onDisconnect}
          >
            {t("Disconnect")}
          </button>
        )}
      </form>
    </details>
  );
}
