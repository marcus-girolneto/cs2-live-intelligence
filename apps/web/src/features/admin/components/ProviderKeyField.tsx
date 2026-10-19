"use client";
import { useI18n } from "@/shared/i18n";
import { Key } from "@/shared/icons";
import { Preset, Form } from "../model/providerForm";
import type { Provider } from "../model/types";
/** Write-only API key field: keep, replace or remove the stored key. */
export function ProviderKeyField({
  provider,
  f,
  set,
  preset,
}: {
  provider: Provider | null;
  f: Form;
  set: (patch: Partial<Form>) => void;
  preset: Preset;
}) {
  const { t } = useI18n();
  return (
    <div className="adm-key">
      <span className="adm-key-label">
        <Key size={16} /> {t("API key")}
      </span>
      {provider?.keyConfigured && f.keyAction === "keep" ? (
        <div className="adm-key-row">
          <code className="adm-key-mask">
            {provider.keyLast4 ? `••••${provider.keyLast4}` : "••••••••"}
          </code>
          <button
            type="button"
            className="btn-link"
            onClick={() => set({ keyAction: "replace" })}
          >
            {t("Replace")}
          </button>
          <button
            type="button"
            className="btn-link danger"
            onClick={() => set({ keyAction: "remove" })}
          >
            {t("Remove key")}
          </button>
        </div>
      ) : f.keyAction === "remove" ? (
        <div className="adm-key-row">
          <span className="chip bad">
            {t("The key will be removed on save.")}
          </span>
          <button
            type="button"
            className="btn-link"
            onClick={() => set({ keyAction: "keep" })}
          >
            {t("Undo")}
          </button>
        </div>
      ) : (
        <div className="adm-key-row">
          <input
            type="password"
            autoComplete="new-password"
            spellCheck={false}
            aria-label={t("API key")}
            placeholder={
              preset === "ollama" ? t("Not needed for Ollama") : "sk-…"
            }
            value={f.apiKey}
            onChange={(e) => set({ apiKey: e.target.value })}
          />
          {provider?.keyConfigured && (
            <button
              type="button"
              className="btn-link"
              onClick={() => set({ keyAction: "keep", apiKey: "" })}
            >
              {t("Keep current key")}
            </button>
          )}
        </div>
      )}
      <span className="field-hint">
        {t("Write-only: stored encrypted and never shown again.")}
      </span>
    </div>
  );
}
