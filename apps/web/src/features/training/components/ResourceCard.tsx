"use client";
import { useI18n } from "@/shared/i18n";
import { mapName } from "@/shared/format";
import { Timer } from "@/shared/icons";
import { resourceTitle, skillLabel } from "../model/copy";
import type { Resource } from "../model/types";
import { ResourceButtons } from "./ResourceButtons";

/** One catalog resource: title, how to use it, Steam buttons. */
export function ResourceCard({
  r,
  compact = false,
}: {
  r: Resource;
  compact?: boolean;
}) {
  const { t } = useI18n();
  return (
    <article className="tr-res" data-testid="training-resource">
      <header>
        <span className="tr-skill">{skillLabel(r.skill, t)}</span>
        <span className="tr-mins">
          <Timer size={12} /> {t("{n} min", { n: r.minutes })}
        </span>
      </header>
      <h4>{resourceTitle(r, t)}</h4>
      {r.maps.length > 0 && (
        <p className="tr-maps muted small">
          {r.maps.map((m) => mapName(m) ?? m).join(", ")}
        </p>
      )}
      {!compact && r.howTo.length > 0 && (
        <ol className="tr-howto">
          {r.howTo.map((h) => (
            <li key={h}>{t(h)}</li>
          ))}
        </ol>
      )}
      <ResourceButtons r={r} />
    </article>
  );
}
