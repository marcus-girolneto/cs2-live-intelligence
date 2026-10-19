import { finite } from "../format/format";

/** The player a viewer marked as themselves in a demo; used as the live-coach baseline. */
export type Me = {
  analysisId: string;
  steamId: string;
  name?: string;
  map?: string;
  kills: number | null;
  deaths: number | null;
  rounds: number | null;
};
const KEY = "cs2.me";
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const store = (): Store | undefined => {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
};
export function parseMe(raw: string | null): Me | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<Me>;
    if (typeof v.analysisId !== "string" || typeof v.steamId !== "string")
      return null;
    return {
      analysisId: v.analysisId,
      steamId: v.steamId,
      ...(typeof v.name === "string" ? { name: v.name.slice(0, 128) } : {}),
      ...(typeof v.map === "string" ? { map: v.map.slice(0, 64) } : {}),
      kills: finite(v.kills),
      deaths: finite(v.deaths),
      rounds: finite(v.rounds),
    };
  } catch {
    return null;
  }
}
export function loadMe(s: Store | undefined = store()): Me | null {
  try {
    return parseMe(s?.getItem(KEY) ?? null);
  } catch {
    return null;
  }
}
export function saveMe(me: Me | null, s: Store | undefined = store()) {
  try {
    if (me) s?.setItem(KEY, JSON.stringify(me));
    else s?.removeItem(KEY);
  } catch {
    /* Storage unavailable (private mode); the preference simply isn't remembered. */
  }
}
