"use client";
import { useAdminApi } from "../api/context";
import { useState } from "react";
import { formatNumber } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { Brain, Check, Database, Gear, Refresh } from "@/shared/icons";
import { DefuseLoader, Callout, Panel, Skeleton } from "@/shared/ui";
import {
  errorText,
  PURPOSE_LABEL,
  PURPOSES,
  type AiStatus,
  type Purpose,
  type PurposeStatus,
  type TestResult,
} from "../model/types";
/** Active configuration per purpose (from ai/status) with a real connectivity test. */
export function ActiveConfig({
  status,
  loading,
  error,
}: {
  status: AiStatus | null;
  loading: boolean;
  error: string;
}) {
  const { t, locale } = useI18n();
  const api = useAdminApi();
  const [busy, setBusy] = useState<{ purpose: string; since: number } | null>(
    null,
  );
  const [result, setResult] = useState<Record<string, TestResult>>({});
  const [failure, setFailure] = useState<Record<string, string>>({});
  async function test(purpose: Purpose) {
    setBusy({ purpose, since: Date.now() });
    setResult((r) => ({ ...r, [purpose]: {} }));
    setFailure((f) => ({ ...f, [purpose]: "" }));
    try {
      const r = await api.testActive(purpose);
      setResult((x) => ({ ...x, [purpose]: r }));
    } catch (e) {
      setFailure((f) => ({ ...f, [purpose]: errorText(e, "Request failed.") }));
    } finally {
      setBusy(null);
    }
  }
  const purposes = PURPOSES.map((p) => ({
    purpose: p,
    s: (status?.purposes?.[p] ??
      (p === "review_quick"
        ? (status?.purposes?.review ?? status)
        : null)) as PurposeStatus | null,
  }));
  return (
    <Panel
      title={t("Active configuration")}
      icon={<Brain size={20} />}
      sub={t(
        "What the coach uses right now. Database assignments override the .env defaults.",
      )}
    >
      {error && (
        <Callout tone="error" role="alert">
          {t(error)}
        </Callout>
      )}
      {loading && !status && <Skeleton lines={4} />}
      <div className="adm-purposes">
        {purposes.map(({ purpose, s }) => {
          if (!s && !loading) return null;
          if (!s) return null;
          const review = purpose === "review_quick";
          const r = result[purpose];
          const answered = r && r.model;
          return (
            <article key={purpose} className="adm-purpose">
              <header>
                <h3>{t(PURPOSE_LABEL[purpose]!)}</h3>
                <span
                  className={`chip ${s.source === "database" ? "accent" : "ct"}`}
                >
                  {s.source === "database" ? (
                    <Database size={14} />
                  ) : (
                    <Gear size={14} />
                  )}
                  {s.source === "database"
                    ? t("Database")
                    : t("Environment (.env)")}
                </span>
              </header>
              {s.configured ? (
                <dl className="kv">
                  <dt>{t("Provider")}</dt>
                  <dd {...(review ? { "data-testid": "ai-provider" } : {})}>
                    {s.provider}
                  </dd>
                  <dt>{t("Model")}</dt>
                  <dd
                    className="mono"
                    {...(review ? { "data-testid": "ai-model" } : {})}
                  >
                    {s.model}
                  </dd>
                  {s.providerName && (
                    <>
                      <dt>{t("Profile")}</dt>
                      <dd>{s.providerName}</dd>
                    </>
                  )}
                  {s.endpoint && (
                    <>
                      <dt>{t("Endpoint")}</dt>
                      <dd className="mono">{s.endpoint}</dd>
                    </>
                  )}
                  {(s.apiStyle || s.jsonMode) && (
                    <>
                      <dt>{t("API style")}</dt>
                      <dd>
                        {[s.apiStyle, s.jsonMode].filter(Boolean).join(" · ")}
                      </dd>
                    </>
                  )}
                  <dt>{t("API key")}</dt>
                  <dd>
                    {s.keyConfigured ? (
                      <span className="adm-ok">
                        <Check size={14} /> {t("Configured")}
                      </span>
                    ) : (
                      t("Not set")
                    )}
                  </dd>
                  {s.dailyLimit !== undefined && (
                    <>
                      <dt>{t("Daily limit")}</dt>
                      <dd>
                        {s.dailyLimit === null || s.dailyLimit === 0
                          ? t("Unlimited")
                          : t("{n} requests per account", {
                              n: formatNumber(s.dailyLimit, 0, locale) ?? "",
                            })}
                      </dd>
                    </>
                  )}
                </dl>
              ) : (
                <Callout tone="warn" title={t("No AI provider configured")}>
                  {s.reason && <p>{s.reason}</p>}
                  {s.missing && s.missing.length > 0 && (
                    <p className="small">
                      {t("Missing: {vars}", { vars: s.missing.join(", ") })}
                    </p>
                  )}
                </Callout>
              )}
              {s.configured && (
                <div className="adm-test">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={!!busy}
                    onClick={() => void test(purpose)}
                  >
                    <Refresh size={16} />
                    {review ? t("Test connection") : t("Test live connection")}
                  </button>
                </div>
              )}
              {busy?.purpose === purpose && (
                <DefuseLoader
                  since={busy.since}
                  title={t("Calling the model…")}
                  steps={[
                    t("Sending a short prompt…"),
                    t("Waiting for the model…"),
                    t("Large models can take a minute."),
                  ]}
                />
              )}
              {answered && (
                <Callout tone="success" role="status" className="adm-result">
                  <span
                    {...(review ? { "data-testid": "ai-test-result" } : {})}
                  >
                    {t("{model} answered in {s}s: “{reply}”", {
                      model: r.model ?? "",
                      s:
                        formatNumber((r.latencyMs ?? 0) / 1000, 1, locale) ??
                        "",
                      reply: r.reply ?? "",
                    })}
                  </span>
                </Callout>
              )}
              {failure[purpose] && (
                <Callout tone="error" role="alert">
                  {failure[purpose]}
                </Callout>
              )}
            </article>
          );
        })}
      </div>
    </Panel>
  );
}
