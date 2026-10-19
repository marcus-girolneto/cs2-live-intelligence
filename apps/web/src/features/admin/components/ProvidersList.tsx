"use client";
import { useAdminApi } from "../api/context";
import { useState } from "react";
import { useI18n } from "@/shared/i18n";
import { Plus, Server } from "@/shared/icons";
import { Callout, EmptyState, Panel, Skeleton } from "@/shared/ui";
import { useModels } from "../hooks/useModels";
import { errorText, type Provider, type TestResult } from "../model/types";
import { ProviderCard } from "./ProviderCard";
import { ProviderEditor } from "./ProviderEditor";
export function ProvidersList({
  providers,
  loading,
  onChanged,
}: {
  providers: Provider[];
  loading: boolean;
  onChanged: () => Promise<unknown>;
}) {
  const { t } = useI18n();
  const api = useAdminApi();
  const [editing, setEditing] = useState<Provider | "new" | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [testing, setTesting] = useState<{ id: string; since: number } | null>(
    null,
  );
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [testErr, setTestErr] = useState<Record<string, string>>({});
  const [testModel, setTestModel] = useState<Record<string, string>>({});
  const { models, busy: fetching, error: modelErr, fetchModels } = useModels();

  async function remove(p: Provider) {
    if (
      !window.confirm(
        t("Delete the provider “{name}”? Its stored key is erased.", {
          name: p.name,
        }),
      )
    )
      return;
    setError("");
    setNotice("");
    try {
      await api.deleteProvider(p.id);
      setNotice(t("Provider deleted."));
      await onChanged();
    } catch (e) {
      setError(errorText(e, "Request failed."));
    }
  }
  async function test(p: Provider) {
    setTesting({ id: p.id, since: Date.now() });
    setResults((r) => ({ ...r, [p.id]: {} }));
    setTestErr((x) => ({ ...x, [p.id]: "" }));
    const model = testModel[p.id]?.trim();
    try {
      const r = await api.testProvider(p.id, model);
      setResults((x) => ({ ...x, [p.id]: r }));
    } catch (e) {
      setTestErr((x) => ({ ...x, [p.id]: errorText(e, "Request failed.") }));
    } finally {
      setTesting(null);
    }
  }

  return (
    <Panel
      title={t("Provider profiles")}
      icon={<Server size={20} />}
      sub={t(
        "Endpoints and credentials stored encrypted in the database. Keys are never sent back to the browser.",
      )}
      actions={
        editing === null && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setEditing("new");
              setNotice("");
            }}
          >
            <Plus size={16} /> {t("Add provider")}
          </button>
        )
      }
    >
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
      {editing !== null && (
        <ProviderEditor
          key={editing === "new" ? "new" : editing.id}
          provider={editing === "new" ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={async (msg) => {
            setEditing(null);
            setNotice(msg);
            await onChanged();
          }}
        />
      )}
      {loading && providers.length === 0 && <Skeleton height={96} />}
      {!loading && providers.length === 0 && editing === null && (
        <EmptyState
          compact
          icon={<Server size={26} />}
          title={t("No provider profiles yet")}
          actions={
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setEditing("new")}
            >
              <Plus size={18} /> {t("Add provider")}
            </button>
          }
        >
          <p>
            {t(
              "The coach uses the .env configuration until you add a provider and assign it a model.",
            )}
          </p>
        </EmptyState>
      )}
      <div className="adm-providers">
        {providers.map((p) => {
          const r = results[p.id];
          const list = models[p.id] ?? [];
          return (
            <ProviderCard
              key={p.id}
              p={p}
              r={r}
              list={list}
              testModel={testModel}
              setTestModel={setTestModel}
              fetching={fetching}
              fetchModels={fetchModels}
              testing={testing}
              test={test}
              onEdit={() => {
                setEditing(p);
                setNotice("");
              }}
              remove={remove}
              modelErr={modelErr}
              testErr={testErr}
            />
          );
        })}
      </div>
    </Panel>
  );
}
