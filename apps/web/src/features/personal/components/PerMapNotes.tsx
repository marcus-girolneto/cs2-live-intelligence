"use client";
import { MapBadge } from "@/features/maps";
import { useI18n } from "@/shared/i18n";
import { MapPin } from "@/shared/icons";
import type { MapNote } from "../model/personal";

/** Short notes per map, with the map badge. */
export function PerMapNotes({ maps }: { maps: MapNote[] }) {
  const { t } = useI18n();
  if (!maps.length) return null;
  return (
    <section className="report-sec" aria-labelledby="pc-maps">
      <h2 className="sec-title" id="pc-maps">
        <MapPin size={18} /> {t("Per-map notes")}
      </h2>
      <div className="pc-maps">
        {maps.map((m) => (
          <article key={m.map} className="pc-map">
            <MapBadge map={m.map} size={28} />
            <ul>
              {m.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
