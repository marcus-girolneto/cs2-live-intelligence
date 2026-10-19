"use client";
import type { SettingsDto } from "@/shared/api-types";
import { useRouter } from "next/navigation";
import { useEffect, useState, type DragEvent, type FormEvent } from "react";
import { UsageMeter, useNow, useUpgrade, useUsage } from "@/features/billing";
import { MAX_DEMO_BYTES } from "@/shared/config/limits";
import { useAccount } from "@/shared/session";
import { formatNumber } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { Check, Play, ShieldCheck, Upload as UploadIcon } from "@/shared/icons";
import { CrosshairLoader, Callout, PageHeader } from "@/shared/ui";
import { useMatchesApi } from "../api/context";
import { useDemoUpload } from "../hooks/useDemoUpload";
import { megabytes, uploadLimitBytes } from "../model/upload";
import { UploadProgress } from "./UploadProgress";
import { SampleImport } from "./SampleImport";
/** /upload: drag-and-drop .dem upload with consent and daily usage. */
export function UploadScreen() {
  const { t, locale } = useI18n();
  const api = useMatchesApi();
  const upgrade = useUpgrade();
  const { usage } = useUsage();
  const now = useNow();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [settings, setSettings] = useState<SettingsDto | null>(null);
  const [consent, setConsent] = useState(false);
  const router = useRouter();
  const { account } = useAccount();
  const limit = uploadLimitBytes(account, MAX_DEMO_BYTES);
  const limitMb = Math.round(megabytes(limit));
  const uploader = useDemoUpload();
  useEffect(() => {
    api
      .getSettings()
      .then((s) => {
        setSettings(s);
        setConsent(s.telemetryConsent);
      })
      .catch(() => setSettings(null));
  }, [api]);
  function choose(next: File | undefined) {
    setError("");
    if (!next) return;
    if (!next.name.toLowerCase().endsWith(".dem")) {
      setError(t("That file is not a demo. Choose a .dem file."));
      return;
    }
    if (next.size > limit) {
      setError(t("The demo exceeds the {mb} MB limit.", { mb: limitMb }));
      return;
    }
    setFile(next);
  }
  function drop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    choose(event.dataTransfer.files?.[0]);
  }
  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      if (settings && !settings.telemetryConsent) {
        if (!consent)
          throw new Error(t("Tick the permission box to process the demo."));
        setSettings(
          await api.saveSettings({ ...settings, telemetryConsent: true }),
        );
      }
      const result = await uploader.start(file);
      if (result === "cancelled") {
        setBusy(false);
        setError(t("Upload cancelled."));
        return;
      }
      router.push(`/history?match=${encodeURIComponent(result.id)}`);
    } catch (e) {
      setBusy(false);
      if (upgrade.handle(e)) return;
      setError(e instanceof Error ? t(e.message) : t("Upload failed."));
    }
  }
  const size = file ? formatNumber(file.size / 1024 / 1024, 1, locale) : null;
  return (
    <main className="page narrow">
      <PageHeader
        eyebrow={t("Upload demo")}
        icon={<UploadIcon size={16} />}
        title={t("Upload your demo")}
        lead={
          <>
            {t(
              "In CS2, open Watch → Your Matches and download the match. The .dem file is saved in:",
            )}{" "}
            <code>game/csgo/replays</code>
          </>
        }
      />
      <UsageMeter kind="uploads" usage={usage} now={now} />
      <form className="upload-form" onSubmit={(e) => void upload(e)}>
        <label
          className={`dropzone ${dragging ? "dragging" : ""} ${file ? "has-file" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={drop}
        >
          <span className="dz-icon">
            {busy ? (
              <CrosshairLoader size={48} />
            ) : file ? (
              <Check size={40} />
            ) : (
              <UploadIcon size={40} />
            )}
          </span>
          <span className="dz-title">
            {file ? file.name : t("Drop the demo here or click to choose")}
          </span>
          <span className="muted">
            {file && size
              ? t("{size} MB · ready to upload", { size })
              : t(".dem file · up to {mb} MB", { mb: limitMb })}
          </span>
          <input
            className="visually-hidden"
            aria-label={t("Demo file")}
            type="file"
            accept=".dem"
            disabled={busy}
            onChange={(e) => choose(e.target.files?.[0])}
          />
        </label>
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
        {uploader.progress && (
          <UploadProgress p={uploader.progress} onCancel={uploader.cancel} />
        )}
        <button className="btn btn-primary btn-lg" disabled={busy || !file}>
          {busy ? (
            <>
              <CrosshairLoader size={20} /> {t("Uploading…")}
            </>
          ) : (
            t("Upload demo")
          )}
        </button>
        {error && (
          <Callout tone="error" role="alert">
            {error}
          </Callout>
        )}
      </form>
      <div className="upload-tips">
        <div>
          <ShieldCheck size={20} />
          <span>
            {t(
              "Corrupt demos show up as “Failed” — no statistics are ever invented from them.",
            )}
          </span>
        </div>
        <div>
          <Play size={20} />
          <div className="tip-text">
            <span>{t("No demo at hand?")}</span>
            <SampleImport compact />
          </div>
        </div>
      </div>
    </main>
  );
}
