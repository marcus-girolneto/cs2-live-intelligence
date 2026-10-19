import { finite, text } from "./format";
import type { SteamProfile } from "../session/account";

/** ISO 3166 alpha-2 → regional-indicator flag emoji ("BR" → 🇧🇷). */
export function flagEmoji(code: unknown): string | null {
  const c = text(code)?.toUpperCase();
  if (!c || !/^[A-Z]{2}$/.test(c)) return null;
  return String.fromCodePoint(
    ...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65),
  );
}

export type Presence = "online" | "ingame" | "away" | "offline";
const STATES: Record<string, Presence> = {
  "0": "offline",
  "1": "online",
  "2": "away", // busy
  "3": "away",
  "4": "away", // snooze
  "5": "online", // looking to trade
  "6": "online", // looking to play
  offline: "offline",
  online: "online",
  busy: "away",
  away: "away",
  snooze: "away",
  "in-game": "ingame",
  "looking to trade": "online",
  "looking to play": "online",
};
export function presence(profile: SteamProfile | undefined): Presence {
  if (!profile) return "offline";
  if (text(profile.currentGame)) return "ingame";
  return STATES[String(profile.personaState ?? "").toLowerCase()] ?? "offline";
}

/** Avatar URL safe for <img>: only https Steam/CDN URLs are rendered. */
export function safeImage(url: unknown): string | null {
  const u = text(url);
  if (!u) return null;
  try {
    const parsed = new URL(u);
    return parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

export function safeLink(url: unknown): string | null {
  return safeImage(url);
}

/** Whole years since an ISO date, or null. */
export function yearsSince(iso: unknown, now = Date.now()): number | null {
  if (typeof iso !== "string") return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t) || t > now) return null;
  return Math.floor((now - t) / (365.25 * 24 * 3600 * 1000));
}

export function hasBans(profile: SteamProfile | undefined): boolean {
  const b = profile?.bans;
  if (!b) return false;
  return (
    (finite(b.vacBans) ?? 0) > 0 ||
    (finite(b.gameBans) ?? 0) > 0 ||
    b.communityBanned === true
  );
}
