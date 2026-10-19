"use client";
import type { Dispatch, SetStateAction } from "react";
import { formatDate, formatNumber } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { Brain, Check, Gear, Globe, Key, Refresh, Trash } from "@/shared/icons";
import { DefuseLoader, Callout } from "@/shared/ui";
import { PURPOSE_LABEL, type Provider, type TestResult } from "../model/types";
import { ModelPicker } from "./ModelPicker";
export type ProviderCardProps = {
  p: Provider;
  r: TestResult | undefined;
  list: string[];
  testModel: Record<string, string>;
  setTestModel: Dispatch<SetStateAction<Record<string, string>>>;
  fetching: string | null;
  fetchModels: (providerId: string) => Promise<void>;
  testing: { id: string; since: number } | null;
  test: (p: Provider) => Promise<void>;
  onEdit: () => void;
  remove: (p: Provider) => Promise<void>;
  modelErr: Record<string, string>;
  testErr: Record<string, string>;
};

/** One saved provider profile: meta, model test and edit/delete actions. */
export function ProviderCard({
  p,
  r,
  list,
  testModel,
  setTestModel,
  fetching,
  fetchModels,
  testing,
  test,
  onEdit,
  remove,
  modelErr,
  testErr,
}: ProviderCardProps) {
  const { t, locale } = useI18n();
  return (
    <article className="adm-provider">
      <header>
        <div className="adm-provider-title">
          <span className="adm-provider-mark">
            {p.name.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <h3>{p.name}</h3>
            <span className="mono small muted">
              {p.provider}
              {p.baseUrl ? ` · ${p.baseUrl}` : ""}
            </span>
          </div>
        </div>
        <div className="chip-row">
          {(p.assignedTo ?? []).map((a) => (
            <span key={a} className="chip accent">
              <Check size={12} /> {t(PURPOSE_LABEL[a])}
            </span>
          ))}
          <span className={`chip ${p.keyConfigured ? "good" : ""}`}>
            <Key size={12} />
            {p.keyConfigured
              ? p.keyLast4
                ? `••••${p.keyLast4}`
                : t("Key stored")
              : t("No key")}
          </span>
          {p.allowHttp && (
            <span className="chip bad">
              <Globe size={12} /> HTTP
            </span>
          )}
        </div>
      </header>
      <dl className="adm-meta">
        {[
          [t("API style"), p.apiStyle],
          [t("JSON mode"), p.jsonMode],
          [t("Max output tokens"), formatNumber(p.maxOutputTokens, 0, locale)],
          [
            t("Timeout"),
            typeof p.timeoutMs === "number"
              ? t("{s}s", {
                  s: formatNumber(p.timeoutMs / 1000, 0, locale) ?? "",
                })
              : null,
          ],
          [t("Attempts"), formatNumber(p.maxAttempts, 0, locale)],
          [t("Temperature"), formatNumber(p.temperature, 1, locale)],
          [
            t("Headers"),
            p.headerNames?.length ? p.headerNames.join(", ") : null,
          ],
          [t("Updated"), formatDate(p.updatedAt, locale)],
        ]
          .filter((x): x is [string, string] => !!x[1])
          .map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
      </dl>
      <div className="adm-provider-test">
        <ModelPicker
          id={`test-model-${p.id}`}
          label={t("Model to test")}
          value={testModel[p.id] ?? ""}
          onChange={(v) => setTestModel((m) => ({ ...m, [p.id]: v }))}
          models={list}
          placeholder={
            p.assignedTo?.length
              ? t("Assigned model by default")
              : t("e.g. gpt-4o-mini")
          }
        />
        <div className="adm-provider-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={fetching === p.id}
            onClick={() => void fetchModels(p.id)}
          >
            <Refresh size={16} />
            {fetching === p.id ? t("Fetching…") : t("Fetch models")}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={!!testing}
            aria-label={t("Test {name}", { name: p.name })}
            onClick={() => void test(p)}
          >
            <Brain size={16} /> {t("Test")}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onEdit}
          >
            <Gear size={16} /> {t("Edit")}
          </button>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            aria-label={t("Delete {name}", { name: p.name })}
            onClick={() => void remove(p)}
          >
            <Trash size={16} />
          </button>
        </div>
      </div>
      {modelErr[p.id] && <p className="form-error">{t(modelErr[p.id]!)}</p>}
      {list.length > 0 && (
        <p className="small muted">
          {t("{n} models available. Type to search.", {
            n: list.length,
          })}
        </p>
      )}
      {testing?.id === p.id && (
        <DefuseLoader
          since={testing.since}
          title={t("Calling the model…")}
          steps={[
            t("Sending a short prompt…"),
            t("Waiting for the model…"),
            t("Large models can take a minute."),
          ]}
        />
      )}
      {r?.model && (
        <Callout tone="success" role="status">
          <span data-testid="provider-test-result">
            {t("{model} answered in {s}s: “{reply}”", {
              model: r.model,
              s: formatNumber((r.latencyMs ?? 0) / 1000, 1, locale) ?? "",
              reply: r.reply ?? "",
            })}
          </span>
        </Callout>
      )}
      {testErr[p.id] && (
        <Callout tone="error" role="alert">
          {t(testErr[p.id]!)}
        </Callout>
      )}
    </article>
  );
}
