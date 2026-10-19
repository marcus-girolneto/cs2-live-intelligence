import { mapName, text } from "../format";
import { Crosshair } from "../icons";

/** Stylised map tile (colour per map, no game artwork). */
export function MapTile({ map, size = 48 }: { map: unknown; size?: number }) {
  const raw = text(map)?.toLowerCase() ?? "unknown";
  const name = mapName(map);
  const short = name ? name.replace(/\s+II$/, "2").slice(0, 3) : "?";
  return (
    <span
      className={`map-tile map-${raw.replace(/[^a-z0-9_]/g, "")}`}
      style={{ width: size, height: size, fontSize: size * 0.32 }}
      aria-hidden
    >
      {name ? <span>{short}</span> : <Crosshair size={size * 0.42} />}
    </span>
  );
}
