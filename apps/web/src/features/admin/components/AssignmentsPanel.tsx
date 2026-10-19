"use client";
import { useAdminApi } from "../api/context";
import { useState, type FormEvent } from "react";
import { formatDate, formatNumber } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { Brain, Check, Monitor, Refresh, Server } from "@/shared/icons";
import {
  CrosshairLoader,
  Callout,
  EmptyState,
  Panel,
  Skeleton,
} from "@/shared/ui";
import { useModels } from "../hooks/useModels";
import {
  errorText,
  PURPOSE_LABEL,
  PURPOSES,
  type Assignments,
  type Provider,
  type Purpose,
} from "../model/types";
import { ModelPicker } from "./ModelPicker";
/* ------------------------------------------------------------ assignments */
export function AssignmentsPanel({
  providers,
  assignments,
  loading,
  onSaved,
}: {
  providers: Provider[];
  assignments: Assignments;
  loading: boolean;
  onSaved: () => Promise<unknown>;
}) {
  const { t, locale } = useI18n();
  const api = useAdminApi();
  type Draft = Record<Purpose, { providerId: string; model: string }>;
  const initial = (): Draft => ({
    review: {
      providerId: assignments.review?.providerId ?? "",
      model: assignments.review?.model ?? "",
    },
    live: {
      providerId: assignments.live?.providerId ?? "",
      model: assignments.live?.model ?? "",
    },
  });
  const [draft, setDraft] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const { models, busy: fetching, error: modelErr, fetchModels } = useModels();
  const set = (p: Purpose, patch: Partial<Draft[Purpose]>) =>
    setDraft((d) => ({ ...d, [p]: { ...d[p], ...patch } }));
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const body: Record<string, unknown> = {};
    for (const p of PURPOSES) {
      const d = draft[p];
      body[p] =
        d.providerId && d.model.trim()
          ? { providerId: d.providerId, model: d.model.trim() }
          : null;
    }
    try {
      await api.saveAssignments(body);
      setNotice(t("Assignments saved. New requests use them immediately."));
      await onSaved();
    } catch (e2) {
      setError(errorText(e2, "Request failed."));
    } finally {
      setBusy(false);
    }
  }
  if (loading && !providers.length) return <Skeleton height={220} />;
  if (!providers.length)
    return (
      <EmptyState icon={<Server size={26} />} title={t("Add a provider first")}>
        <p>
          {t(
            "Model assignment picks a saved provider profile for each purpose. Without assignments the .env configuration is used.",
          )}
        </p>
      </EmptyState>
    );
  return (
    <form className="adm-assign" onSubmit={(e) => void save(e)}>
      <div className="grid-2">
        {PURPOSES.map((p) => {
          const d = draft[p];
          const current = assignments[p];
          const list = d.providerId ? (models[d.providerId] ?? []) : [];
          return (
            <Panel
              key={p}
              className={p === "live" ? "tone-ct" : ""}
              title={t(PURPOSE_LABEL[p])}
              icon={
                p === "review" ? <Brain size={20} /> : <Monitor size={20} />
              }
              sub={
                p === "review"
                  ? t(
                      "Full AI Coach review after each demo. Prefer a strong model.",
                    )
                  : t("Short IGL calls between rounds. Prefer a fast model.")
              }
            >
              <label>
                {t("Provider")}
                <select
                  value={d.providerId}
                  onChange={(e) => set(p, { providerId: e.target.value })}
                >
                  <option value="">{t("Use .env default")}</option>
                  {providers.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name} · {x.provider}
                    </option>
                  ))}
                </select>
              </label>
              {d.providerId && (
                <>
                  <ModelPicker
                    id={`assign-${p}`}
                    label={t("Model")}
                    value={d.model}
                    onChange={(v) => set(p, { model: v })}
                    models={list}
                  />
                  <div className="form-actions">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={fetching === d.providerId}
                      onClick={() => void fetchModels(d.providerId)}
                    >
                      {fetching === d.providerId ? (
                        <CrosshairLoader size={16} />
                      ) : (
                        <Refresh size={16} />
                      )}
                      {t("Fetch models")}
                    </button>
                    {list.length > 0 && (
                      <span className="small muted">
                        {t("{n} models available. Type to search.", {
                          n: list.length,
                        })}
                      </span>
                    )}
                  </div>
                  {modelErr[d.providerId] && (
                    <p className="form-error">{t(modelErr[d.providerId]!)}</p>
                  )}
                </>
              )}
              <p className="small muted adm-current">
                {current
                  ? t("Current: {model} · since {date}", {
                      model: current.model,
                      date: formatDate(current.updatedAt, locale) ?? "—",
                    })
                  : t("Current: .env default")}
              </p>
            </Panel>
          );
        })}
      </div>
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
      <div className="form-actions">
        <button
          className="btn btn-primary"
          disabled={
            busy ||
            PURPOSES.some((p) => draft[p].providerId && !draft[p].model.trim())
          }
        >
          <Check size={18} /> {busy ? t("Saving…") : t("Save assignments")}
        </button>
        <span className="small muted">
          {formatNumber(providers.length, 0, locale)}{" "}
          {t("provider profile(s) available")}
        </span>
      </div>
    </form>
  );
}
