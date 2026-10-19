"use client";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/shared/i18n";
import { Server } from "@/shared/icons";
import { Callout, EmptyState, Skeleton } from "@/shared/ui";
import { useAdminApi } from "../api/context";
import { useModels } from "../hooks/useModels";
import { effectiveSource } from "../model/assign";
import {
  errorText,
  legacyPurpose,
  PURPOSE_LABEL,
  PURPOSES,
  type AiStatus,
  type Assignments,
  type Provider,
  type Purpose,
  type TestResult,
} from "../model/types";
import { PurposeCard, type PurposeDraft } from "./PurposeCard";

/** Model assignment: one card per purpose, each tested and saved on its own. */
export function AssignmentsPanel({
  providers,
  assignments,
  status,
  loading,
  onSaved,
}: {
  providers: Provider[];
  assignments: Assignments;
  status: AiStatus | null;
  loading: boolean;
  onSaved: () => Promise<unknown>;
}) {
  const { t } = useI18n();
  const api = useAdminApi();
  const current = (p: Purpose) => {
    const legacy = legacyPurpose(p);
    return assignments[p] ?? (legacy ? assignments[legacy] : undefined);
  };
  const baseline = (p: Purpose): PurposeDraft => ({
    providerId: current(p)?.providerId ?? "",
    model: current(p)?.model ?? "",
  });
  const [draft, setDraft] = useState<Record<Purpose, PurposeDraft>>(
    () =>
      Object.fromEntries(PURPOSES.map((p) => [p, baseline(p)])) as Record<
        Purpose,
        PurposeDraft
      >,
  );
  const [saving, setSaving] = useState<Purpose | null>(null);
  const [testing, setTesting] = useState<Purpose | null>(null);
  const [results, setResults] = useState<Partial<Record<Purpose, TestResult>>>(
    {},
  );
  const [testErr, setTestErr] = useState<Partial<Record<Purpose, string>>>({});
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const touched = useRef(new Set<Purpose>());
  // Assignments arrive (or change after a save): refresh every card the admin hasn't edited.
  const assignmentsKey = JSON.stringify(assignments);
  useEffect(() => {
    setDraft((d) => {
      const next = { ...d };
      for (const p of PURPOSES)
        if (!touched.current.has(p)) next[p] = baseline(p);
      return next;
    });
    // baseline() reads the same assignments this key serialises.
  }, [assignmentsKey]);
  const models = useModels();
  const { ensure } = models;
  // Load each selected provider's model list once.
  useEffect(() => {
    for (const p of PURPOSES) ensure(draft[p].providerId);
  }, [draft, ensure]);

  const set = (p: Purpose, patch: Partial<PurposeDraft>) => {
    touched.current.add(p);
    setDraft((d) => ({
      ...d,
      [p]: {
        ...d[p],
        ...patch,
        // A new provider means a new model list: clear the model.
        ...(patch.providerId !== undefined &&
        patch.providerId !== d[p].providerId
          ? { model: "" }
          : {}),
      },
    }));
    setResults((r) => ({ ...r, [p]: undefined }));
    setTestErr((r) => ({ ...r, [p]: "" }));
  };
  async function save(p: Purpose) {
    const d = draft[p];
    setSaving(p);
    setError("");
    setNotice("");
    try {
      await api.saveAssignments({
        [p]:
          d.providerId && d.model.trim()
            ? { providerId: d.providerId, model: d.model.trim() }
            : null,
      });
      setNotice(
        t("{purpose} saved. New requests use it immediately.", {
          purpose: t(PURPOSE_LABEL[p]!),
        }),
      );
      touched.current.delete(p);
      await onSaved();
    } catch (e) {
      setError(errorText(e, "Request failed."));
    } finally {
      setSaving(null);
    }
  }
  async function test(p: Purpose) {
    const d = draft[p];
    setTesting(p);
    setResults((r) => ({ ...r, [p]: undefined }));
    setTestErr((r) => ({ ...r, [p]: "" }));
    try {
      // No own provider: test what the purpose actually runs on (fallback or .env).
      const r = d.providerId
        ? await api.testProvider(d.providerId, d.model.trim())
        : await api.testActive(p);
      setResults((x) => ({ ...x, [p]: r }));
    } catch (e) {
      setTestErr((x) => ({ ...x, [p]: errorText(e, "Request failed.") }));
    } finally {
      setTesting(null);
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
    <div className="adm-assign">
      <Callout tone="info">
        {t(
          "Each purpose runs on its own model. Unassigned purposes fall back: Deep review and Monthly report use Quick review, Personal Coach uses Deep review, then the .env defaults.",
        )}
      </Callout>
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
      <div className="pa-grid">
        {PURPOSES.map((p) => {
          const d = draft[p];
          const b = baseline(p);
          return (
            <PurposeCard
              key={p}
              purpose={p}
              providers={providers}
              draft={d}
              saved={current(p)}
              effective={effectiveSource(p, assignments, status?.purposes?.[p])}
              catalog={d.providerId ? models.catalogs[d.providerId] : undefined}
              fetching={!!models.busy[d.providerId]}
              listError={models.error[d.providerId] ?? ""}
              onChange={(patch) => set(p, patch)}
              onRefetch={() => void models.fetchModels(d.providerId)}
              onTest={() => void test(p)}
              testing={testing === p}
              result={results[p]}
              testError={testErr[p] ?? ""}
              onSave={() => void save(p)}
              saving={saving === p}
              dirty={
                d.providerId !== b.providerId || d.model.trim() !== b.model
              }
            />
          );
        })}
      </div>
    </div>
  );
}
