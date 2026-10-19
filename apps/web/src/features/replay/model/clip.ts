/**
 * Clip reference: a ≤40 s window of one round that the 2D player can replay. Parsed
 * defensively from coaching payloads (key moments, insights).
 */
import { finite, text } from "@/shared/format";

export type ClipRef = {
  round: number;
  from: number;
  to: number;
  /** Seconds since freeze end of the key event inside the window. */
  at?: number;
  steamId?: string;
  eventId?: string;
  /** Demo event ids shown in the clip (the first kill among them is the key moment). */
  eventIds?: string[];
  label?: string;
};

/** Longest window the replay API serves. */
export const MAX_CLIP_SECONDS = 40;

const obj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
const strs = (v: unknown) =>
  (Array.isArray(v) ? v : []).map(text).filter((s): s is string => s !== null);
const first = (o: Record<string, unknown>, keys: string[]) => {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k];
  return undefined;
};
const opt = <K extends string, V>(key: K, value: V | null | undefined) =>
  (value === null || value === undefined ? {} : { [key]: value }) as Partial<
    Record<K, V>
  >;

export function parseClip(raw: unknown): ClipRef | undefined {
  const o = obj(raw);
  if (!o) return undefined;
  const round = finite(first(o, ["round", "roundNumber"]));
  const at = finite(first(o, ["at", "t", "time", "keyTime", "eventTime"]));
  let from = finite(first(o, ["from", "start", "startTime"]));
  let to = finite(first(o, ["to", "end", "endTime"]));
  if (round === null || round < 1) return undefined;
  if (from === null && at !== null) from = Math.max(0, at - 6);
  if (to === null && from !== null) to = from + 12;
  if (from === null || to === null || to <= from) return undefined;
  from = Math.max(0, from);
  if (to - from > MAX_CLIP_SECONDS) to = from + MAX_CLIP_SECONDS;
  const steamId = text(
    first(o, ["steamId", "focus", "focusSteamId", "player"]),
  );
  const eventId = text(o.eventId);
  const eventIds = strs(o.eventIds);
  return {
    round: Math.round(round),
    from,
    to,
    ...(at !== null && at >= from && at <= to ? { at } : {}),
    ...opt("steamId", steamId),
    ...opt("eventId", eventId),
    ...(eventIds.length ? { eventIds } : {}),
    ...opt("label", text(o.label)),
  };
}
