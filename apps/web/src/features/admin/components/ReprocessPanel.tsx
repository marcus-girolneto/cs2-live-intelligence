"use client";
import { useAdminApi } from "../api/context";
import { useState } from "react";
import { formatNumber } from "@/shared/format";
import { ApiError } from "@/shared/http";
import { useI18n } from "@/shared/i18n";
import { Refresh } from "@/shared/icons";
import { CrosshairLoader, Callout, Panel } from "@/shared/ui";
import { errorText, isForbidden } from "../model/types";
/** Re-runs the analytics on every stored demo (e.g. after a parser/metrics upgrade). */
export function ReprocessPanel({ onForbidden }: { onForbidden: () => void }) {
  const { t, locale } = useI18n();
  const api = useAdminApi();
  const [busy, setBusy] = useState(false);
  const [queued, setQueued] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [missing, setMissing] = useState(false);
  async function run() {
    if (
      !window.confirm(
        t(
          "Reprocess every stored demo with the current parser and metrics? Existing analyses are replaced when the new ones finish.",
        ),
      )
    )
      return;
    setBusy(true);
    setError("");
    setQueued(null);
    try {
      const r = await api.reprocess();
      setQueued(typeof r?.queued === "number" ? r.queued : 0);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setMissing(true);
      else {
        if (isForbidden(e)) onForbidden();
        setError(errorText(e, "Request failed."));
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel
      className="adm-span tone-t"
      title={t("Analyses")}
      icon={<Refresh size={20} />}
      sub={t(
        "Re-run the analytics on every stored demo, for example after a parser upgrade adds new data (aim, positions, utility, economy).",
      )}
      actions={
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={busy || missing}
          onClick={() => void run()}
        >
          {busy ? <CrosshairLoader size={16} /> : <Refresh size={16} />}
          {t("Reprocess all analyses")}
        </button>
      }
    >
      {queued !== null && (
        <Callout tone="success" role="status">
          {t("{n} analyses queued", {
            n: formatNumber(queued, 0, locale) ?? "0",
          })}
        </Callout>
      )}
      {missing && (
        <Callout tone="warn">
          {t("This API version cannot reprocess analyses yet.")}
        </Callout>
      )}
      {error && (
        <Callout tone="error" role="alert">
          {t(error)}
        </Callout>
      )}
    </Panel>
  );
}
