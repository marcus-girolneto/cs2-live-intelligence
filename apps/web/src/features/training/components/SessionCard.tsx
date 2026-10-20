"use client";
import { useI18n } from "@/shared/i18n";
import { placeName } from "@/shared/format";
import { Check, MapPin, Play, Timer } from "@/shared/icons";
import { resourceTitle, sessionCopy, stepLabel } from "../model/copy";
import type { OnPlay, Resource, Session } from "../model/types";
import { ResourceButtons } from "./ResourceButtons";

/** One step of the pro-team session: what, why, done-when and the exact resources. */
export function SessionCard({
  s,
  index,
  resources,
  onPlay,
}: {
  s: Session;
  index: number;
  resources: Resource[];
  onPlay?: OnPlay;
}) {
  const { t } = useI18n();
  const place = (p: string) => placeName(p) ?? p;
  const copy = sessionCopy(s, t, place);
  const linked = s.resourceIds
    .map((id) => resources.find((r) => r.id === id))
    .filter((r): r is Resource => !!r);
  return (
    <li className={`tr-session ${s.step}`} data-testid="training-session">
      <div className="tr-step" aria-hidden>
        {index + 1}
      </div>
      <div className="tr-body">
        <p className="tr-meta">
          <span className="tr-step-name">{stepLabel(s.step, t)}</span>
          <span className="tr-mins">
            <Timer size={12} /> {t("{n} min", { n: s.minutes })}
          </span>
        </p>
        <h4>{copy.title}</h4>
        <p className="tr-why">{copy.why}</p>
        <p className="tr-done">
          <Check size={14} /> <b>{t("Done when:")}</b> {copy.criteria}
        </p>
        {s.teleportIds.length > 0 && (
          <p className="tr-tp-note muted small">
            <MapPin size={12} />{" "}
            {t(
              "{n, plural, one {# spot} other {# spots}} in the practice server box below",
              {
                n: s.teleportIds.length,
              },
            )}
          </p>
        )}
        {s.clips.length > 0 && onPlay && (
          <div className="tr-clips">
            {s.clips.map((c, i) => (
              <button
                key={`${c.round}-${i}`}
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  onPlay(
                    {
                      round: c.round,
                      from: c.from,
                      to: c.to,
                      steamId: c.focusSteamId,
                      eventIds: c.eventIds,
                      ...(c.label ? { label: c.label } : {}),
                    },
                    copy.title,
                  )
                }
              >
                <Play size={14} /> {t("Round {n}", { n: c.round })}
              </button>
            ))}
          </div>
        )}
        {linked.map((r) => (
          <div key={r.id} className="tr-linked">
            <span className="tr-linked-title">{resourceTitle(r, t)}</span>
            <ResourceButtons r={r} />
          </div>
        ))}
      </div>
    </li>
  );
}
