"use client";
import type { ParsedObject } from "../model/providerForm";
import { useI18n } from "@/shared/i18n";
import { Form } from "../model/providerForm";
import type { Provider } from "../model/types";
import { JsonHint } from "./JsonHint";
/** Advanced provider options: API style, JSON mode, limits, headers and extra body. */
export function ProviderAdvanced({
  provider,
  f,
  set,
  headers,
  extra,
}: {
  provider: Provider | null;
  f: Form;
  set: (patch: Partial<Form>) => void;
  headers: ParsedObject;
  extra: ParsedObject;
}) {
  const { t } = useI18n();
  return (
    <details className="adm-advanced">
      <summary>{t("Advanced options")}</summary>
      <div className="form-grid">
        <div className="form-row">
          <label>
            {t("API style")}
            <select
              value={f.apiStyle}
              onChange={(e) =>
                set({ apiStyle: e.target.value as Form["apiStyle"] })
              }
            >
              <option value="">{t("Automatic")}</option>
              <option value="chat">chat/completions</option>
              <option value="responses">responses</option>
            </select>
          </label>
          <label>
            {t("JSON mode")}
            <select
              value={f.jsonMode}
              onChange={(e) =>
                set({ jsonMode: e.target.value as Form["jsonMode"] })
              }
            >
              <option value="">{t("Automatic")}</option>
              <option value="json_schema">json_schema</option>
              <option value="json_object">json_object</option>
              <option value="prompt">{t("prompt only")}</option>
            </select>
          </label>
          <label>
            {t("Max tokens parameter")}
            <input
              spellCheck={false}
              placeholder="max_tokens"
              value={f.maxTokensParam}
              onChange={(e) => set({ maxTokensParam: e.target.value })}
            />
          </label>
        </div>
        <div className="form-row">
          <label>
            {t("Max output tokens")}
            <input
              type="number"
              min={64}
              max={200000}
              value={f.maxOutputTokens}
              onChange={(e) => set({ maxOutputTokens: e.target.value })}
            />
          </label>
          <label>
            {t("Timeout (ms)")}
            <input
              type="number"
              min={1000}
              max={600000}
              step={1000}
              value={f.timeoutMs}
              onChange={(e) => set({ timeoutMs: e.target.value })}
            />
          </label>
          <label>
            {t("Attempts")}
            <input
              type="number"
              min={1}
              max={5}
              value={f.maxAttempts}
              onChange={(e) => set({ maxAttempts: e.target.value })}
            />
          </label>
          <label>
            {t("Temperature")}
            <input
              type="number"
              min={0}
              max={2}
              step={0.1}
              value={f.temperature}
              onChange={(e) => set({ temperature: e.target.value })}
            />
          </label>
        </div>
        <label>
          {t("Extra headers (JSON)")}
          <textarea
            className="mono"
            spellCheck={false}
            rows={3}
            placeholder={
              provider?.headerNames?.length
                ? t("Stored: {names}. Leave untouched to keep them.", {
                    names: provider.headerNames.join(", "),
                  })
                : '{"HTTP-Referer": "https://example.com"}'
            }
            value={f.headers}
            aria-invalid={f.headersDirty && !headers.ok}
            onChange={(e) =>
              set({ headers: e.target.value, headersDirty: true })
            }
          />
          <JsonHint parsed={headers} dirty={f.headersDirty} />
        </label>
        <label>
          {t("Extra request body (JSON)")}
          <textarea
            className="mono"
            spellCheck={false}
            rows={4}
            placeholder='{"reasoning": {"effort": "low"}}'
            value={f.extraBody}
            aria-invalid={f.extraBodyDirty && !extra.ok}
            onChange={(e) =>
              set({ extraBody: e.target.value, extraBodyDirty: true })
            }
          />
          <JsonHint parsed={extra} dirty={f.extraBodyDirty} />
        </label>
      </div>
    </details>
  );
}
