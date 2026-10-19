"use client";
import { useEffect, useState } from "react";
import { BRAND, LogoMark } from "@/shared/brand";
import { useI18n } from "@/shared/i18n";
import { useElapsed } from "@/shared/hooks";

/** Step 3: full-width CS loader while the real AI call runs (10–60 s). */
export function CoachRunning({
  since,
  tier = "quick",
  events,
  playerName,
}: {
  since: number;
  tier?: "quick" | "deep";
  events: number;
  playerName: string;
}) {
  const { t, locale } = useI18n();
  const elapsed = useElapsed(since);
  const lines = [
    t("Reading {n} events…", { n: events.toLocaleString(locale) }),
    t("Tracking your crosshair…"),
    t("Mapping every duel you took…"),
    t("Checking who traded whom…"),
    t("Counting your utility…"),
    t("Calling the IGL…"),
    t("Comparing you with the lobby…"),
    t("Checking every claim against the demo…"),
    t("Writing your plan for the next match…"),
  ];
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % lines.length), 2600);
    return () => clearInterval(id);
  }, [lines.length]);
  const progress = Math.min(96, (1 - Math.exp(-elapsed / 22)) * 100);
  return (
    <div
      className="coach-run"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="cr-logo">
        <LogoMark size={128} animated />
      </div>
      <span className={`tier-tag ${tier}`}>
        {tier === "deep" ? t("Deep review") : t("Quick review")}
      </span>
      <h2>
        {t("{coach} is reviewing {name}", {
          coach: BRAND.coach,
          name: playerName,
        })}
      </h2>
      <p className="cr-line" key={i}>
        {lines[i]}
      </p>
      <div className="cr-defuse">
        <span className="cr-kit" aria-hidden>
          C4
        </span>
        <div className="cr-bar">
          <i style={{ width: `${progress}%` }} />
        </div>
        <span className="cr-time">
          {t("{s}s", {
            s: elapsed.toLocaleString(locale, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            }),
          })}
        </span>
      </div>
      <p className="muted small">
        {tier === "deep"
          ? t(
              "A Deep review uses a stronger AI and can take a few minutes. Keep this tab open.",
            )
          : t("A real review takes 10 to 60 seconds. Keep this tab open.")}
      </p>
    </div>
  );
}
