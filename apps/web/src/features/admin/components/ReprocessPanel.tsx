"use client";
import { useAdminApi } from "../api/context";
import { useEffect, useState } from "react";
import { formatNumber } from "@/shared/format";
import { ApiError } from "@/shared/http";
import { useI18n } from "@/shared/i18n";
import { Refresh } from "@/shared/icons";
import { CrosshairLoader, Callout, Panel } from "@/shared/ui";
import type { ReprocessStatus } from "../model/quality";
import { errorText, isForbidden } from "../model/types";
/** Re-runs the analytics on every stored demo (e.g. after a parser/metrics upgrade). */
export function ReprocessPanel({ onForbidden }: { onForbidden: () => void }) {
  const { t, locale } = useI18n();
  const api = useAdminApi();
  const [busy, setBusy] = useState(false);
  const [queued, setQueued] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [missing, setMissing] = useState(false);
  const [status, setStatus] = useState<ReprocessStatus | null>(null);
  // Progress of background re-parses; polls while some are still pending.
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () =>
      api
        .reprocessStatus()
        .then((s) => {
          if (!alive) return;
          setStatus(s);
          if (s.pending > 0) timer = setTimeout(load, 10_000);
        })
        .catch(() => undefined);
    void load();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [api, queued]);
  const total = status ? status.pending + status.done : 0;
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
      {status && total > 0 && (
        <div className="reprocess-status">
          <div
            className="meter"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={status.done}
            aria-label={t("Analyses on the current parser")}
          >
            <i
              style={{ width: `${Math.round((status.done / total) * 100)}%` }}
            />
          </div>
          <p className="muted small">
            {t(
              "{done} of {total} analyses on parser {v} · {pending} pending · {failed} failed",
              {
                done: formatNumber(status.done, 0, locale) ?? "0",
                total: formatNumber(total, 0, locale) ?? "0",
                v: status.currentVersion ?? "—",
                pending: formatNumber(status.pending, 0, locale) ?? "0",
                failed: formatNumber(status.failed, 0, locale) ?? "0",
              },
            )}
          </p>
        </div>
      )}
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
