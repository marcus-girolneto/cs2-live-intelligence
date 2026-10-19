"use client";
import { useI18n } from "@/shared/i18n";
import { Brain } from "@/shared/icons";
import { Panel } from "@/shared/ui";
import type { Progress } from "@/features/maps";

type Profile = NonNullable<Progress["profile"]>;
/** Tendencies and recurring patterns the coach learned. */
export function LearnedPanel({ profile }: { profile: Profile }) {
  const { t } = useI18n();
  return (
    <Panel
      icon={<Brain size={20} />}
      title={t("What the coach learned about you")}
      sub={t("From {m} matches and {r} rounds.", {
        m: profile.matches,
        r: profile.rounds,
      })}
    >
      {profile.tendencies.length > 0 && (
        <div className="chip-row">
          {profile.tendencies.map((x) => (
            <span key={x} className="chip accent">
              {t(x)}
            </span>
          ))}
        </div>
      )}
      {profile.recurring.length > 0 && (
        <ul className="recurring">
          {profile.recurring.map((r) => (
            <li key={r.pattern}>
              <span>{t(r.pattern)}</span>
              <span className="rec-dots" aria-hidden>
                {Array.from({ length: profile.matches }, (_, i) => (
                  <i key={i} className={i < r.matches ? "on" : ""} />
                ))}
              </span>
              <b>
                {t("{n} of {m} matches", {
                  n: r.matches,
                  m: profile.matches,
                })}
              </b>
            </li>
          ))}
        </ul>
      )}
      {profile.tendencies.length === 0 && profile.recurring.length === 0 && (
        <p className="muted small">
          {t("Analyze more matches so the coach can spot patterns.")}
        </p>
      )}
    </Panel>
  );
}
