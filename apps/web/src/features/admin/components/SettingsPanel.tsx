"use client";
import { useAdminApi } from "../api/context";
import { useEffect, useState, type FormEvent } from "react";
import { formatDate, formatNumber } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { Brain, Check, Database, Gear } from "@/shared/icons";
import { Callout, Panel, Skeleton } from "@/shared/ui";
import { useResource } from "../hooks/useResource";
import {
  errorText,
  isForbidden,
  PURPOSE_LABEL,
  PURPOSES,
  type AppSettings,
} from "../model/types";
import {
  productBody,
  productProblems,
  productSettingsOf,
  type ProductSettings,
} from "../model/settings";
import { ProductSettingsPanel } from "./ProductSettingsPanel";
import { ReprocessPanel } from "./ReprocessPanel";
/* ------------------------------------------------------------ app settings */
export function SettingsPanel({ onForbidden }: { onForbidden: () => void }) {
  const { t, locale } = useI18n();
  const api = useAdminApi();
  const { data, setData, error, loading } = useResource<AppSettings>(
    "admin/settings",
    onForbidden,
  );
  const [daily, setDaily] = useState("");
  const [bytes, setBytes] = useState("");
  const [sample, setSample] = useState(true);
  const [product, setProduct] = useState<ProductSettings>(() =>
    productSettingsOf(undefined),
  );
  const known = data?.settings as Record<string, unknown> | undefined;
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [saveError, setSaveError] = useState("");
  useEffect(() => {
    const s = data?.settings;
    if (!s) return;
    setDaily(s.dailyLimit === null ? "" : String(s.dailyLimit));
    setBytes(s.maxInputBytes === null ? "" : String(s.maxInputBytes));
    setSample(s.sampleDemoEnabled);
    setProduct(productSettingsOf(s as Record<string, unknown>));
  }, [data]);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (Object.keys(productProblems(product)).length) return;
    setBusy(true);
    setNotice("");
    setSaveError("");
    try {
      const next = await api.saveSettings({
        dailyLimit: daily.trim() ? Number(daily) : null,
        maxInputBytes: bytes.trim() ? Number(bytes) : null,
        sampleDemoEnabled: sample,
        ...productBody(product, known),
      });
      setData(next);
      setNotice(t("App settings saved."));
    } catch (e2) {
      if (isForbidden(e2)) onForbidden();
      setSaveError(errorText(e2, "Request failed."));
    } finally {
      setBusy(false);
    }
  }
  const eff = data?.effective;
  const kb = (n: unknown) =>
    typeof n === "number" ? formatNumber(n / 1000, 0, locale) : null;
  if (loading && !data) return <Skeleton height={260} />;
  return (
    <form className="grid-2 adm-settings" onSubmit={(e) => void save(e)}>
      <Panel
        title={t("AI usage")}
        icon={<Brain size={20} />}
        sub={t(
          "Limits applied to every account. Empty fields use the .env defaults.",
        )}
      >
        {error && (
          <Callout tone="error" role="alert">
            {t(error)}
          </Callout>
        )}
        <label>
          {t("Daily AI requests per account")}
          <input
            type="number"
            min={0}
            max={1000000}
            inputMode="numeric"
            placeholder={t("Default (.env)")}
            value={daily}
            onChange={(e) => setDaily(e.target.value)}
          />
          <span className="field-hint">
            {t("0 = unlimited · empty = .env default")}
            {eff && " · "}
            {eff &&
              (eff.dailyLimit === null ||
              eff.dailyLimit === undefined ||
              eff.dailyLimit === 0
                ? t("effective: unlimited")
                : t("effective: {n}", {
                    n: formatNumber(eff.dailyLimit, 0, locale) ?? "",
                  }))}
          </span>
        </label>
        <label>
          {t("Max evidence sent to the model (bytes)")}
          <input
            type="number"
            min={1000}
            max={5000000}
            step={1000}
            inputMode="numeric"
            placeholder={t("Default (.env)")}
            value={bytes}
            onChange={(e) => setBytes(e.target.value)}
          />
          {kb(eff?.maxInputBytes) && (
            <span className="field-hint">
              {t("effective: {n} KB", { n: kb(eff?.maxInputBytes)! })}
            </span>
          )}
        </label>
      </Panel>
      <Panel
        title={t("Onboarding")}
        icon={<Gear size={20} />}
        sub={t("What new players can do before uploading their own demo.")}
      >
        <label className="check">
          <input
            type="checkbox"
            checked={sample}
            onChange={(e) => setSample(e.target.checked)}
          />
          <span>
            {t("Offer the public sample match")}
            <span className="field-hint block">
              {eff?.sampleDemoConfigured === false
                ? t("No sample demo file is configured on the server.")
                : t("Players can import it with one click from the dashboard.")}
            </span>
          </span>
        </label>
        {eff?.aiSource && (
          <dl className="kv">
            {PURPOSES.map((p) => (
              <div key={p} className="kv-row">
                <dt>{t(PURPOSE_LABEL[p]!)}</dt>
                <dd>
                  {(eff.aiSource?.[p] ??
                    (p === "review_quick"
                      ? eff.aiSource?.review
                      : undefined)) === "database" ? (
                    <span className="chip accent">
                      <Database size={12} /> {t("Database")}
                    </span>
                  ) : (
                    <span className="chip ct">
                      <Gear size={12} /> {t("Environment (.env)")}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {data?.updatedAt && (
          <p className="small muted">
            {t("Last changed {date}", {
              date: formatDate(data.updatedAt, locale) ?? "–",
            })}
          </p>
        )}
      </Panel>
      <ProductSettingsPanel
        value={product}
        known={known}
        onChange={setProduct}
      />
      <ReprocessPanel onForbidden={onForbidden} />
      <div className="adm-span form-actions">
        <button className="btn btn-primary" disabled={busy}>
          <Check size={18} /> {busy ? t("Saving…") : t("Save app settings")}
        </button>
        {notice && (
          <Callout tone="success" role="status">
            {notice}
          </Callout>
        )}
        {saveError && (
          <Callout tone="error" role="alert">
            {t(saveError)}
          </Callout>
        )}
      </div>
    </form>
  );
}
