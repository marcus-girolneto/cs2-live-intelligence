"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/shared/i18n";
import { Crown, Refresh } from "@/shared/icons";
import { Callout, CrosshairLoader, Panel, Skeleton } from "@/shared/ui";
import type { Currency, Plan } from "@/features/billing";
import { useAdminPlans } from "../hooks/useAdminPlans";
import {
  NUMERIC_LIMITS,
  money,
  parseLimit,
  parseMoney,
  setLimit,
  type NumericLimit,
} from "../model/draft";

const LIMIT_LABEL: Record<NumericLimit, string> = {
  aiReviewsPerDay: "AI reviews / day",
  liveAiMatchesPerDay: "Live AI matches / day",
  uploadsPerDay: "Uploads / day",
  retentionDays: "History (days)",
};

/** Admin: edit plan limits, prices (BRL/USD, monthly/yearly) and availability. */
export function PlansEditor({ onForbidden }: { onForbidden: () => void }) {
  const { t } = useI18n();
  const { plans, error, notice, saving, save, reload } =
    useAdminPlans(onForbidden);
  const [draft, setDraft] = useState<Plan[] | null>(null);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => setDraft(plans), [plans]);
  const update = (i: number, next: Plan) =>
    setDraft((d) => d && d.map((p, j) => (j === i ? next : p)));
  return (
    <Panel
      icon={<Crown size={20} />}
      title={t("Plans")}
      sub={t(
        "Limits apply per day (UTC). Leave a limit empty for unlimited. Prices in BRL and USD.",
      )}
      actions={
        <button type="button" className="btn btn-ghost btn-sm" onClick={reload}>
          <Refresh size={16} /> {t("Refresh")}
        </button>
      }
    >
      {notice && (
        <Callout tone="success" role="status">
          {t(notice)}
        </Callout>
      )}
      {error && (
        <Callout tone="error" role="alert">
          {t(error)}
        </Callout>
      )}
      {!draft ? (
        <Skeleton height={220} />
      ) : (
        <form
          className="adm-plans"
          onSubmit={(e) => {
            e.preventDefault();
            if (!invalid) void save(draft);
          }}
          onInput={(e) =>
            setInvalid(!(e.currentTarget as HTMLFormElement).checkValidity())
          }
        >
          {draft.map((plan, i) => (
            <fieldset key={plan.id} className="adm-plan">
              <legend>
                <code>{plan.id}</code>
              </legend>
              <label>
                {t("Name")}
                <input
                  value={plan.name}
                  maxLength={40}
                  required
                  onChange={(e) => update(i, { ...plan, name: e.target.value })}
                />
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={plan.active}
                  onChange={(e) =>
                    update(i, { ...plan, active: e.target.checked })
                  }
                />
                {t("Available for sale")}
              </label>
              <div className="adm-plan-grid">
                {(["BRL", "USD"] as Currency[]).flatMap((cur) =>
                  (["month", "year"] as const).map((iv) => (
                    <label key={`${cur}-${iv}`}>
                      {cur} · {iv === "month" ? t("Monthly") : t("Yearly")}
                      <input
                        inputMode="decimal"
                        pattern="[0-9]+([.,][0-9]{1,2})?"
                        defaultValue={money(plan.prices[cur][iv])}
                        onChange={(e) => {
                          const c = parseMoney(e.target.value);
                          if (c !== undefined)
                            update(i, {
                              ...plan,
                              prices: {
                                ...plan.prices,
                                [cur]: { ...plan.prices[cur], [iv]: c },
                              },
                            });
                        }}
                      />
                    </label>
                  )),
                )}
                {NUMERIC_LIMITS.map((key) => (
                  <label key={key}>
                    {t(LIMIT_LABEL[key])}
                    <input
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="∞"
                      defaultValue={plan.limits[key] ?? ""}
                      onChange={(e) => {
                        const v = parseLimit(e.target.value);
                        if (v !== undefined) update(i, setLimit(plan, key, v));
                      }}
                    />
                  </label>
                ))}
              </div>
              <div className="chip-row">
                <label className="check">
                  <input
                    type="checkbox"
                    checked={plan.limits.clipExport}
                    onChange={(e) =>
                      update(i, {
                        ...plan,
                        limits: {
                          ...plan.limits,
                          clipExport: e.target.checked,
                        },
                      })
                    }
                  />
                  {t("Clip video export")}
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={plan.limits.perMapLearning}
                    onChange={(e) =>
                      update(i, {
                        ...plan,
                        limits: {
                          ...plan.limits,
                          perMapLearning: e.target.checked,
                        },
                      })
                    }
                  />
                  {t("Per-map deep learning")}
                </label>
              </div>
            </fieldset>
          ))}
          <div className="form-actions">
            <button className="btn btn-primary" disabled={saving || invalid}>
              {saving && <CrosshairLoader size={18} />} {t("Save plans")}
            </button>
          </div>
        </form>
      )}
    </Panel>
  );
}
