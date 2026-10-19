"use client";
import { MapTile } from "@/shared/ui";
import { mapLabel } from "../model/maps";

/** Consistent map badge: coloured tile + display name ("de_mirage" → Mirage). */
export function MapBadge({
  map,
  size = 22,
  label = true,
}: {
  map: unknown;
  size?: number;
  label?: boolean;
}) {
  const name = mapLabel(map);
  return (
    <span className="map-badge">
      <MapTile map={map} size={size} />
      {label && name && <span>{name}</span>}
    </span>
  );
}
