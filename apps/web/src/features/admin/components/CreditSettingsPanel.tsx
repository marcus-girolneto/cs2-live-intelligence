"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useI18n } from "@/shared/i18n";
import { Check, Coin } from "@/shared/icons";
import { Callout, CrosshairLoader, Panel, Skeleton } from "@/shared/ui";
import { useAdminApi } from "../api/context";
import { CREDIT_FIELDS, type CreditSettings } from "../model/credits";
import { errorText, isForbidden } from "../model/types";

/** Admin: welcome credits, review costs and anti-abuse limits of the credit economy. */
export function CreditSettingsPanel({
  onForbidden,
}: {
  onForbidden: () => void;
}) {
  const { t } = useI18n();
  const api = useAdminApi();
  const [draft, setDraft] = useState<CreditSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    api
      .getCreditSettings()
      .then(setDraft)
      .catch((e: unknown) => {
        if (isForbidden(e)) onForbidden();
        setError(errorText(e, "Request failed."));
      });
  }, [api, onForbidden]);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      setDraft(await api.saveCreditSettings(draft));
      setNotice(t("Credit settings saved."));
    } catch (e2) {
      setError(errorText(e2, "Request failed."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel
      icon={<Coin size={20} />}
      title={t("Credit economy")}
      sub={t(
        "Welcome grant, review costs and limits that keep free credits fair.",
      )}
    >
      {error && (
        <Callout tone="error" role="alert">
          {t(error)}
        </Callout>
      )}
      {!draft ? (
        !error && <Skeleton height={200} />
      ) : (
        <form className="adm-credits" onSubmit={(e) => void save(e)}>
          <div className="adm-plan-grid">
            {CREDIT_FIELDS.map((f) => (
              <label key={f.key}>
                {t(f.label)}
                <input
                  type="number"
                  min={f.min}
                  max={10000}
                  step={1}
                  inputMode="numeric"
                  required
                  value={draft[f.key]}
                  onChange={(e) => {
                    const v = Math.round(Number(e.target.value));
                    if (Number.isFinite(v) && v >= f.min)
                      setDraft({ ...draft, [f.key]: v });
                  }}
                />
                <span className="field-hint">{t(f.hint)}</span>
              </label>
            ))}
          </div>
          {notice && (
            <Callout tone="success" role="status">
              {notice}
            </Callout>
          )}
          <div className="form-actions">
            <button className="btn btn-primary" disabled={busy}>
              {busy ? <CrosshairLoader size={18} /> : <Check size={18} />}
              {t("Save credit settings")}
            </button>
          </div>
        </form>
      )}
    </Panel>
  );
}
