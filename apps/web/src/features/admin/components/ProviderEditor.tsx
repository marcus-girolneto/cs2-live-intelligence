"use client";
import { useAdminApi } from "../api/context";
import { useMemo, useState, type FormEvent } from "react";
import { useI18n } from "@/shared/i18n";
import { Check, Close } from "@/shared/icons";
import { Callout } from "@/shared/ui";
import {
  parseObject,
  formFrom,
  presetOf,
  Preset,
  PRESETS,
  Form,
} from "../model/providerForm";
import { errorText, type Provider } from "../model/types";
import { ProviderAdvanced } from "./ProviderAdvanced";
import { ProviderKeyField } from "./ProviderKeyField";
export function ProviderEditor({
  provider,
  onCancel,
  onSaved,
}: {
  provider: Provider | null;
  onCancel: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const api = useAdminApi();
  const [preset, setPreset] = useState<Preset>(presetOf(provider));
  const [f, setF] = useState<Form>(() => formFrom(provider));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (patch: Partial<Form>) => setF((x) => ({ ...x, ...patch }));
  const headers = useMemo(() => parseObject(f.headers, true), [f.headers]);
  const extra = useMemo(() => parseObject(f.extraBody, false), [f.extraBody]);
  const nameOk = f.name.trim().length > 0;
  const labelOk = /^[a-z0-9][a-z0-9._-]{0,31}$/.test(
    f.provider.trim().toLowerCase(),
  );
  const urlOk = (() => {
    if (!f.baseUrl.trim()) return true;
    try {
      const u = new URL(f.baseUrl.trim());
      return u.protocol === "https:" || (u.protocol === "http:" && f.allowHttp);
    } catch {
      return false;
    }
  })();
  const valid =
    nameOk &&
    labelOk &&
    urlOk &&
    (!f.headersDirty || headers.ok) &&
    (!f.extraBodyDirty || extra.ok);

  function choosePreset(id: Preset) {
    setPreset(id);
    const p = PRESETS.find((x) => x.id === id)!;
    if (id === "custom") {
      set({ allowHttp: false });
      return;
    }
    set({
      provider: p.provider,
      baseUrl: p.baseUrl,
      allowHttp: p.allowHttp === true,
      ...(!provider ? { name: p.label } : {}),
    });
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError("");
    const num = (s: string) => (s.trim() ? Number(s) : undefined);
    const body: Record<string, unknown> = {
      name: f.name.trim(),
      provider: f.provider.trim().toLowerCase(),
      baseUrl: f.baseUrl.trim() || null,
    };
    const opts: Record<string, unknown> = {
      apiStyle: f.apiStyle || undefined,
      jsonMode: f.jsonMode || undefined,
      maxTokensParam: f.maxTokensParam.trim() || undefined,
      maxOutputTokens: num(f.maxOutputTokens),
      timeoutMs: num(f.timeoutMs),
      maxAttempts: num(f.maxAttempts),
      allowHttp: f.allowHttp,
    };
    if (f.temperature.trim()) opts.temperature = Number(f.temperature);
    else if (provider && typeof provider.temperature === "number")
      opts.temperature = null;
    for (const [k, v] of Object.entries(opts)) if (v !== undefined) body[k] = v;
    if (f.keyAction === "replace" && f.apiKey.trim())
      body.apiKey = f.apiKey.trim();
    if (f.keyAction === "remove" && provider) body.apiKey = null;
    if (f.headersDirty && headers.ok) body.headers = headers.value;
    if (
      (f.extraBodyDirty || !provider) &&
      extra.ok &&
      (provider || f.extraBody.trim())
    )
      body.extraBody = extra.value;
    try {
      await api.saveProvider(provider?.id ?? null, body);
      await onSaved(provider ? t("Provider updated.") : t("Provider added."));
    } catch (e2) {
      setError(errorText(e2, "Request failed."));
      setBusy(false);
    }
  }
  return (
    <form className="adm-editor" onSubmit={(e) => void save(e)}>
      <header className="adm-editor-head">
        <h3>
          {provider
            ? t("Edit {name}", { name: provider.name })
            : t("New provider")}
        </h3>
        <button
          type="button"
          className="icon-btn"
          aria-label={t("Close editor")}
          onClick={onCancel}
        >
          <Close size={18} />
        </button>
      </header>
      <fieldset>
        <legend>{t("Preset")}</legend>
        <div className="adm-presets">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className="adm-preset"
              aria-pressed={preset === p.id}
              onClick={() => choosePreset(p.id)}
            >
              <strong>{t(p.label)}</strong>
              <small>{t(p.hint)}</small>
            </button>
          ))}
        </div>
      </fieldset>
      <div className="form-row">
        <label>
          {t("Display name")}
          <input
            required
            maxLength={64}
            value={f.name}
            onChange={(e) => set({ name: e.target.value })}
          />
        </label>
        <label>
          {t("Provider label")}
          <input
            required
            maxLength={32}
            value={f.provider}
            aria-invalid={!labelOk}
            spellCheck={false}
            onChange={(e) => set({ provider: e.target.value })}
          />
          <span className={labelOk ? "field-hint" : "field-hint bad"}>
            {t("Lowercase letters, digits, dot, dash or underscore.")}
          </span>
        </label>
      </div>
      <label>
        {t("Base URL")}
        <input
          type="url"
          inputMode="url"
          spellCheck={false}
          placeholder="https://…/v1"
          value={f.baseUrl}
          aria-invalid={!urlOk}
          onChange={(e) => set({ baseUrl: e.target.value })}
        />
        <span className={urlOk ? "field-hint" : "field-hint bad"}>
          {urlOk
            ? t("Leave empty to use the provider's default endpoint.")
            : t(
                "Use an https:// URL, or allow plain HTTP below for local servers.",
              )}
        </span>
      </label>
      <ProviderKeyField provider={provider} f={f} set={set} preset={preset} />
      <label className="check">
        <input
          type="checkbox"
          checked={f.allowHttp}
          onChange={(e) => set({ allowHttp: e.target.checked })}
        />
        {t("Allow plain HTTP (local servers only)")}
      </label>
      <ProviderAdvanced
        provider={provider}
        f={f}
        set={set}
        headers={headers}
        extra={extra}
      />
      {error && (
        <Callout tone="error" role="alert">
          {t(error)}
        </Callout>
      )}
      <div className="form-actions">
        <button className="btn btn-primary" disabled={busy || !valid}>
          <Check size={18} />
          {busy
            ? t("Saving…")
            : provider
              ? t("Save provider")
              : t("Add provider")}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          {t("Cancel")}
        </button>
      </div>
    </form>
  );
}
