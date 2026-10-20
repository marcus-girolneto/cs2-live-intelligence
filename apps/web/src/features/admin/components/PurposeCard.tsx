"use client";
import { formatDate, formatNumber } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import {
  ShieldCheck,
  Users,
  Alert,
  Bolt,
  Brain,
  Check,
  Coin,
  Database,
  Layers,
  Medal,
  Monitor,
  Play,
  Refresh,
  Star,
} from "@/shared/icons";
import { CrosshairLoader } from "@/shared/ui";
import {
  checkModel,
  estimateCost,
  type Effective,
  type ModelCatalog,
} from "../model/assign";
import {
  PURPOSE_HINT,
  PURPOSE_LABEL,
  type Assignment,
  type Provider,
  type Purpose,
  type TestResult,
} from "../model/types";
import { ModelPicker } from "./ModelPicker";

export type PurposeDraft = { providerId: string; model: string };

const ICON: Record<Purpose, typeof Bolt> = {
  review_quick: Bolt,
  review_deep: Layers,
  live: Monitor,
  report: Medal,
  personal_coach: Star,
  review_team: Users,
  verify: ShieldCheck,
};

/** One purpose: provider + searchable model, validation, cost hint, test and save. */
export function PurposeCard({
  purpose: p,
  providers,
  draft,
  saved,
  effective,
  catalog,
  fetching,
  listError,
  onChange,
  onRefetch,
  onTest,
  testing,
  result,
  testError,
  onSave,
  saving,
  dirty,
}: {
  purpose: Purpose;
  providers: Provider[];
  draft: PurposeDraft;
  saved: Assignment | undefined;
  effective: Effective;
  catalog: ModelCatalog | undefined;
  fetching: boolean;
  listError: string;
  onChange: (patch: Partial<PurposeDraft>) => void;
  onRefetch: () => void;
  onTest: () => void;
  testing: boolean;
  result: TestResult | undefined;
  testError: string;
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
}) {
  const { t, locale } = useI18n();
  const Icon = ICON[p];
  const check = draft.providerId ? checkModel(draft.model, catalog) : "ok";
  const info = catalog?.models.find((m) => m.id === draft.model.trim());
  const price = info?.price ?? null;
  const cost = estimateCost(p, price);
  const canSave =
    dirty &&
    !saving &&
    (draft.providerId ? check !== "empty" && check !== "unknown" : true);
  const label = t(PURPOSE_LABEL[p]!);
  return (
    <article
      className={`pa-card ${effective.kind}`}
      data-testid={`purpose-${p}`}
    >
      <header className="pa-head">
        <span className="pa-icon" aria-hidden>
          <Icon size={20} />
        </span>
        <div>
          <h3>{label}</h3>
          <p className="muted small">{t(PURPOSE_HINT[p])}</p>
        </div>
        <SourceBadge e={effective} />
      </header>

      <div className="pa-fields">
        <label>
          {t("Provider")}
          <select
            value={draft.providerId}
            onChange={(e) => onChange({ providerId: e.target.value })}
          >
            <option value="">{fallbackLabel(p, t)}</option>
            {providers.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name} · {x.provider}
              </option>
            ))}
          </select>
        </label>
        {draft.providerId && (
          <div className="pa-model">
            <ModelPicker
              id={`assign-${p}`}
              label={t("Model")}
              value={draft.model}
              onChange={(v) => onChange({ model: v })}
              models={catalog?.models.map((m) => m.id) ?? []}
              placeholder={
                catalog?.listed
                  ? t("Search {n} models", { n: catalog.models.length })
                  : undefined
              }
            />
            <button
              type="button"
              className="btn btn-ghost btn-sm pa-refetch"
              onClick={onRefetch}
              disabled={fetching}
              aria-label={t("Reload the model list")}
              title={t("Reload the model list")}
            >
              {fetching ? <CrosshairLoader size={16} /> : <Refresh size={16} />}
            </button>
          </div>
        )}
      </div>

      {draft.providerId && (
        <div className="pa-notes">
          {fetching && !catalog && (
            <p className="small muted">
              {t("Loading this provider's models…")}
            </p>
          )}
          {check === "unknown" && (
            <p className="form-error">
              <Alert size={14} />{" "}
              {t(
                "This provider doesn't list “{model}”. Pick one from the list.",
                { model: draft.model.trim() },
              )}
            </p>
          )}
          {check === "manual" && !fetching && (
            <p className="small muted">
              {listError
                ? `${t(listError)} ${t("Type the model id manually.")}`
                : t(
                    "This provider has no model list. Type the model id manually.",
                  )}
            </p>
          )}
          {check === "ok" && draft.model.trim() && (
            <p className="small pa-cost">
              <Coin size={14} />{" "}
              {cost !== null
                ? t("≈ {cost} per call at list price", {
                    cost: `$${formatNumber(cost, cost < 0.01 ? 4 : 3, locale) ?? "0"}`,
                  })
                : t("Price not published by this provider.")}
              {info?.contextLength && (
                <span className="muted">
                  {" · "}
                  {t("{n}k context", {
                    n: Math.round(info.contextLength / 1000),
                  })}
                </span>
              )}
              {info?.structuredOutputs === false && (
                <span className="pa-warn">
                  {" · "}
                  {t("no structured outputs")}
                </span>
              )}
            </p>
          )}
        </div>
      )}

      {(result || testError) && (
        <div className={`pa-test ${testError ? "bad" : "good"}`} role="status">
          {testError ? (
            <>
              <Alert size={16} /> {t(testError)}
            </>
          ) : (
            <>
              <Check size={16} />{" "}
              {t("Answered in {ms} ms", {
                ms: formatNumber(result?.latencyMs ?? null, 0, locale) ?? "–",
              })}
              {result?.reply && <q>{result.reply}</q>}
            </>
          )}
        </div>
      )}

      <footer className="pa-foot">
        <span className="small muted">
          {saved
            ? t("Saved: {model} · {date}", {
                model: saved.model,
                date: formatDate(saved.updatedAt, locale) ?? "–",
              })
            : t("Not assigned")}
        </span>
        <div className="pa-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onTest}
            disabled={
              testing ||
              (!!draft.providerId && (check === "empty" || check === "unknown"))
            }
          >
            {testing ? <CrosshairLoader size={16} /> : <Play size={14} />}{" "}
            {t("Test")}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onSave}
            disabled={!canSave}
          >
            <Check size={14} />{" "}
            {saving ? t("Saving…") : t("Save {purpose}", { purpose: label })}
          </button>
        </div>
      </footer>
    </article>
  );
}

function fallbackLabel(
  p: Purpose,
  t: (k: string, v?: Record<string, string | number>) => string,
) {
  if (p === "review_deep" || p === "report") return t("Same as Quick review");
  if (p === "personal_coach") return t("Same as Deep review");
  return t("Use .env default");
}

function SourceBadge({ e }: { e: Effective }) {
  const { t } = useI18n();
  if (e.kind === "own")
    return (
      <span className="pa-src own">
        <Brain size={13} /> {t("Assigned")}
      </span>
    );
  if (e.kind === "fallback")
    return (
      <span className="pa-src fallback">
        <Layers size={13} />{" "}
        {t("Uses {purpose}", { purpose: t(PURPOSE_LABEL[e.from]!) })}
      </span>
    );
  if (e.kind === "env")
    return (
      <span className="pa-src env">
        <Database size={13} /> {t("Falls back to .env")}
      </span>
    );
  return (
    <span className="pa-src none">
      <Alert size={13} /> {t("Not configured")}
    </span>
  );
}
