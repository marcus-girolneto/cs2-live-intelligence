"use client";
import Link from "next/link";
import { useI18n } from "@/shared/i18n";
import { ShieldCheck } from "@/shared/icons";
import { Panel, Skeleton } from "@/shared/ui";
import type { SettingsVM } from "../hooks/useSettings";
import { retentionOptions } from "../model/retention";
/** Consent and retention preferences. */
export function PrivacyPanel({ vm }: { vm: SettingsVM }) {
  const { t } = useI18n();
  const { settings, setSettings, retentionMax, busy, save } = vm;
  return (
    <Panel
      id="privacy"
      icon={<ShieldCheck size={20} />}
      title={t("Consent & retention")}
      sub={t(
        "Choose which data may be processed. The server enforces these choices.",
      )}
    >
      {!settings ? (
        <Skeleton lines={3} />
      ) : (
        <form className="form-grid" onSubmit={(e) => void save(e)}>
          <label className="check">
            <input
              type="checkbox"
              checked={settings.telemetryConsent}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  telemetryConsent: e.target.checked,
                })
              }
            />
            {t("Allow match telemetry and demo processing")}
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={settings.analyticsConsent}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  analyticsConsent: e.target.checked,
                })
              }
            />
            {t("Allow product analytics and feedback collection")}
          </label>
          <label className="narrow-field">
            {t("Data retention (days)")}
            <select
              value={settings.retentionDays}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  retentionDays: Number(e.target.value),
                })
              }
            >
              {retentionOptions(retentionMax, settings.retentionDays).map(
                (d) => (
                  <option key={d} value={d}>
                    {t("{n} days", { n: d })}
                  </option>
                ),
              )}
            </select>
            <small className="muted">
              {t("Your plan keeps matches for up to {n} days.", {
                n: retentionMax,
              })}{" "}
              <Link href="/pricing">{t("See plans")}</Link>
            </small>
          </label>
          <div className="form-actions">
            <button className="btn btn-primary" disabled={busy}>
              {t("Save settings")}
            </button>
            <Link href="/privacy">{t("Read the privacy notice")}</Link>
          </div>
        </form>
      )}
    </Panel>
  );
}
