"use client";
import { useI18n } from "@/shared/i18n";
import { Globe } from "@/shared/icons";
import { MapBadge } from "./MapBadge";

/** "All maps / Mirage / Inferno …" chips (null = all maps). */
export function MapSwitcher({
  maps,
  value,
  onChange,
}: {
  maps: string[];
  value: string | null;
  onChange: (map: string | null) => void;
}) {
  const { t } = useI18n();
  if (!maps.length) return null;
  return (
    <div className="map-switch" role="group" aria-label={t("Map")}>
      <button
        type="button"
        aria-pressed={value === null}
        onClick={() => onChange(null)}
      >
        <Globe size={16} /> {t("All maps")}
      </button>
      {maps.map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={value === m}
          onClick={() => onChange(m)}
        >
          <MapBadge map={m} size={20} />
        </button>
      ))}
    </div>
  );
}
