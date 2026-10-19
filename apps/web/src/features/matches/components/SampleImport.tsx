"use client";
import type { ReactNode } from "react";
import type { SettingsDto } from "@/shared/api-types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useUpgrade } from "@/features/billing";
import { useI18n } from "@/shared/i18n";
import { Play } from "@/shared/icons";
import { CrosshairLoader } from "@/shared/ui";
import { useMatchesApi } from "../api/context";
/** Imports the operator's public sample demo into the signed-in account. */
export function SampleImport({
  compact,
  fallback = null,
  big,
}: { compact?: boolean; fallback?: ReactNode; big?: boolean } = {}) {
  const { t } = useI18n();
  const api = useMatchesApi();
  const upgrade = useUpgrade();
  const router = useRouter();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [settings, setSettings] = useState<SettingsDto | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    api
      .sampleAvailable()
      .then(setAvailable)
      .catch(() => setAvailable(false));
    api
      .getSettings()
      .then((s) => {
        setSettings(s);
        setConsent(s.telemetryConsent);
      })
      .catch(() => setSettings(null));
  }, [api]);
  if (available === null) return null;
  if (!available) return <>{fallback}</>;
  async function load() {
    setBusy(true);
    setError("");
    try {
      if (settings && !settings.telemetryConsent) {
        if (!consent)
          throw new Error(t("Tick the permission box to process the demo."));
        await api.saveSettings({ ...settings, telemetryConsent: true });
      }
      const job = await api.importSample();
      router.push(`/history?match=${encodeURIComponent(job.id)}`);
    } catch (e) {
      setBusy(false);
      if (upgrade.handle(e)) return;
      setError(e instanceof Error ? t(e.message) : t("Request failed."));
    }
  }
  return (
    <div className={`sample-import ${compact || big ? "compact" : ""}`}>
      {!compact && !big && (
        <p className="muted">
          {t(
            "New here? Load a real public CS2 match into your account to try everything right away.",
          )}
        </p>
      )}
      {settings && !settings.telemetryConsent && (
        <label className="check">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          {t("I allow this demo to be processed to generate the analysis.")}
        </label>
      )}
      <button
        type="button"
        className={`btn ${compact ? "btn-ghost btn-sm" : "btn-primary"} ${big ? "btn-lg" : ""}`}
        disabled={busy}
        onClick={() => void load()}
      >
        {busy ? <CrosshairLoader size={18} /> : <Play size={18} />}{" "}
        {busy ? t("Loading…") : t("Load sample match")}
      </button>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </div>
  );
}
