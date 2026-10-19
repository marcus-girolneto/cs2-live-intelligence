"use client";
import { useState } from "react";
import { formatNumber } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { User } from "@/shared/icons";
import { Callout } from "@/shared/ui";
import type { Candidate } from "../model/journey";

/** First step when we don't know who you are: pick your player in your demos. */
export function IdentityStep({
  candidates,
  onChoose,
}: {
  candidates: Candidate[];
  onChoose: (steamId: string) => Promise<void>;
}) {
  const { t, locale } = useI18n();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  async function choose(id: string) {
    setBusy(id);
    setError("");
    try {
      await onChoose(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy(null);
    }
  }
  return (
    <section className="identity-step" aria-labelledby="identity-title">
      <h2 id="identity-title">{t("Which player are you in these demos?")}</h2>
      <p className="lead-text">
        {t(
          "Progress follows one player across your matches. Pick yourself once — you can change it later in Settings.",
        )}
      </p>
      {error && (
        <Callout tone="error" role="alert">
          {t(error)}
        </Callout>
      )}
      <ul className="identity-cards">
        {candidates.map((c) => (
          <li key={c.steamId}>
            <button
              type="button"
              className="identity-card"
              disabled={busy !== null}
              onClick={() => void choose(c.steamId)}
            >
              <span className="ic-avatar" aria-hidden>
                <User size={20} />
              </span>
              <span className="ic-name">{c.name}</span>
              <span className="ic-meta">
                {t("{n} matches", { n: formatNumber(c.matches, 0, locale)! })} ·{" "}
                {t("{n} reviews", { n: formatNumber(c.reviews, 0, locale)! })}
              </span>
              <span className="ic-cta">
                {busy === c.steamId ? t("Saving…") : t("This is me")}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
