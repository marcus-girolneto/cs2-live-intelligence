"use client";
import { useEffect, useState } from "react";
import { useCredits } from "@/features/billing";
import { useI18n } from "@/shared/i18n";
import { Bolt } from "@/shared/icons";
import { Callout, Panel } from "@/shared/ui";
import { useSettingsApi } from "../api/context";
import type { AutoReview } from "../model/types";

const parse = (v: unknown): AutoReview | null => {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  return {
    enabled: o.enabled === true,
    tier: o.tier === "deep" ? "deep" : "quick",
  };
};

/** Settings → Coach: review my new demos automatically (uses credits). */
export function AutoReviewPanel() {
  const { t, lang } = useI18n();
  const api = useSettingsApi();
  const { cost, isAdmin } = useCredits();
  const [value, setValue] = useState<AutoReview | null>(null);
  const [supported, setSupported] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api
      .getCoachProfile()
      .then((p) => {
        const a = parse(p.autoReview);
        setSupported(!!a);
        setValue(a ?? { enabled: false, tier: "quick" });
      })
      .catch(() => setSupported(false));
  }, [api]);
  if (!supported || !value) return null;
  async function save(next: AutoReview) {
    setValue(next);
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const p = await api.saveCoachProfile({ autoReview: { ...next, lang } });
      setValue(parse(p.autoReview) ?? next);
      setNotice(
        next.enabled
          ? t("Automatic reviews are on.")
          : t("Automatic reviews are off."),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }
  const credits = (n: number) =>
    n === 1 ? t("1 credit") : t("{n} credits", { n });
  return (
    <Panel
      id="auto-review"
      icon={<Bolt size={20} />}
      title={t("Automatic reviews")}
      sub={t(
        "When a demo of yours finishes processing, the AI Coach reviews it right away.",
      )}
    >
      <div className="form-grid">
        <label className="check switch-row">
          <input
            type="checkbox"
            checked={value.enabled}
            disabled={busy}
            onChange={(e) => void save({ ...value, enabled: e.target.checked })}
          />
          {t("Analyze my new demos automatically")}
        </label>
        <label className="field">
          <span>{t("Review type")}</span>
          <select
            value={value.tier}
            disabled={busy || !value.enabled}
            onChange={(e) =>
              void save({
                ...value,
                tier: e.target.value === "deep" ? "deep" : "quick",
              })
            }
          >
            <option value="quick">
              {t("Quick review")} · {credits(cost("quick"))}
            </option>
            <option value="deep">
              {t("Deep review")} · {credits(cost("deep"))}
            </option>
          </select>
        </label>
        <p className="muted small">
          {isAdmin
            ? t("Admins are never charged.")
            : t(
                "Each automatic review uses credits. If you don't have enough, it is skipped and the match shows “Not enough credits”. Demos you're not in are never reviewed.",
              )}
        </p>
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
      </div>
    </Panel>
  );
}
