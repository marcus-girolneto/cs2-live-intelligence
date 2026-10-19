"use client";
import Link from "next/link";
import { useRefreshProfile } from "@/features/auth";
import { useEffect, useState } from "react";
import { useI18n } from "@/shared/i18n";
import { Gift, Play, Refresh, Upload } from "@/shared/icons";
import { useAccount } from "@/shared/session";
import { Callout, CrosshairLoader, Dialog } from "@/shared/ui";
import { useCredits } from "../../hooks/useCredits";
import { welcomeCopy } from "../../model/welcome";

/**
 * New-player hook: once per account and welcome status, a modal explains the free review
 * (granted) or kindly why it isn't there yet (pending / ineligible). Also renders inline as a
 * dashboard banner while the status is not "granted".
 */
export function WelcomeCredits({
  variant = "modal",
}: {
  variant?: "modal" | "banner";
}) {
  const { t } = useI18n();
  const { account } = useAccount();
  const { credits } = useCredits();
  const welcome = credits?.welcome;
  const key = `fragmind.welcome.${account?.ownerId ?? "anon"}.${welcome?.status ?? "none"}`;
  const [seen, setSeen] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      setSeen(window.localStorage.getItem(key) === "1");
    } catch {
      setSeen(false);
    }
  }, [key]);
  const { busy, note, refreshProfile } = useRefreshProfile();
  const copy = welcome ? welcomeCopy(welcome) : null;
  if (!welcome || !account || !copy) return null;
  const refresh = copy.refresh ? (
    <>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        disabled={busy}
        onClick={() => void refreshProfile()}
      >
        {busy ? <CrosshairLoader size={16} /> : <Refresh size={16} />}
        {t("Refresh my Steam profile")}
      </button>
      {note && (
        <span className="small muted" role="status">
          {note}
        </span>
      )}
    </>
  ) : null;
  const body = (
    <>
      <p>{t(copy.body)}</p>
      {copy.steps && (
        <ol className="welcome-steps">
          {copy.steps.map((s) => (
            <li key={s}>{t(s)}</li>
          ))}
        </ol>
      )}
    </>
  );
  if (variant === "banner") {
    if (welcome.status === "granted") return null;
    return (
      <Callout tone="info" title={t(copy.title)}>
        {body}
        {refresh && <div className="form-actions">{refresh}</div>}
      </Callout>
    );
  }
  // Unknown until storage is read after mount, so the modal never flashes on load.
  if (seen !== false) return null;
  const close = () => {
    setSeen(true);
    try {
      window.localStorage.setItem(key, "1");
    } catch {
      /* storage unavailable: shown again next visit */
    }
  };
  return (
    <Dialog
      className="welcome-dlg"
      title={
        <>
          <Gift size={22} /> {t(copy.title)}
        </>
      }
      onClose={close}
    >
      <div className={`welcome-art ${welcome.status}`} aria-hidden>
        <span className="wa-coin">
          {welcome.status === "granted" ? "1" : "?"}
        </span>
      </div>
      {body}
      <div className="form-actions">
        {welcome.status === "granted" ? (
          <>
            <Link className="btn btn-primary" href="/demo" onClick={close}>
              <Play size={18} /> {t("Try it on the sample match")}
            </Link>
            <Link className="btn btn-ghost" href="/upload" onClick={close}>
              <Upload size={18} /> {t("Upload my demo")}
            </Link>
          </>
        ) : (
          <>
            {refresh}
            <button type="button" className="btn btn-primary" onClick={close}>
              {t("Got it")}
            </button>
          </>
        )}
      </div>
    </Dialog>
  );
}
