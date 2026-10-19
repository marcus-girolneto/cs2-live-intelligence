import type { PersonaState, SteamProfile } from "./steam-profile.types.js";
import { orderProfile } from "./steam-profile.js";
import {
  cleanText,
  htmlToText,
  int,
  obj,
  personaStates,
  safeImageUrl,
  safeProfileUrl,
} from "./steam-text.js";

/** Re-validates a cached profile from the database before serving it. */
export function sanitizeStoredProfile(
  value: unknown,
): SteamProfile | undefined {
  const p = obj(value);
  const personaName = cleanText(p.personaName, 64);
  if (!personaName) return undefined;
  const out: Record<string, unknown> = {
    personaName,
    visibility: ["public", "friends", "private"].includes(
      p.visibility as string,
    )
      ? p.visibility
      : "private",
    fetchedAt:
      typeof p.fetchedAt === "string" &&
      Number.isFinite(Date.parse(p.fetchedAt))
        ? new Date(p.fetchedAt).toISOString()
        : new Date(0).toISOString(),
  };
  const text = (k: string, max: number): void => {
    const v = cleanText(p[k], max);
    if (v) out[k] = v;
  };
  text("realName", 64);
  text("location", 128);
  text("currentGame", 128);
  const avatarUrl = safeImageUrl(p.avatarUrl);
  if (avatarUrl) out.avatarUrl = avatarUrl;
  const avatarMediumUrl = safeImageUrl(p.avatarMediumUrl);
  if (avatarMediumUrl) out.avatarMediumUrl = avatarMediumUrl;
  const profileUrl = safeProfileUrl(p.profileUrl);
  if (profileUrl) out.profileUrl = profileUrl;
  if (typeof p.countryCode === "string" && /^[A-Z]{2}$/.test(p.countryCode))
    out.countryCode = p.countryCode;
  if (typeof p.summary === "string") {
    const s = htmlToText(p.summary);
    if (s) out.summary = s;
  }
  for (const k of ["steamMemberSince", "lastLogoff"])
    if (typeof p[k] === "string" && Number.isFinite(Date.parse(p[k] as string)))
      out[k] = new Date(p[k] as string).toISOString();
  for (const k of [
    "steamLevel",
    "friendsCount",
    "badgesCount",
    "groupsCount",
  ]) {
    const n = int(p[k], 0, 1e6);
    if (n !== undefined) out[k] = n;
  }
  if ([...personaStates, "in-game"].includes(p.personaState as PersonaState))
    out.personaState = p.personaState;
  const num = (v: unknown): number | undefined =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 1e7
      ? v
      : undefined;
  const cs2 = obj(p.cs2);
  if (num(cs2.playtimeHours) !== undefined)
    out.cs2 = {
      playtimeHours: num(cs2.playtimeHours),
      ...(num(cs2.playtime2WeeksHours) !== undefined
        ? { playtime2WeeksHours: num(cs2.playtime2WeeksHours) }
        : {}),
    };
  const bans = obj(p.bans);
  if (num(bans.vacBans) !== undefined)
    out.bans = {
      vacBans: Math.floor(num(bans.vacBans)!),
      gameBans: Math.floor(num(bans.gameBans) ?? 0),
      communityBanned: bans.communityBanned === true,
      ...(num(bans.daysSinceLastBan) !== undefined
        ? { daysSinceLastBan: Math.floor(num(bans.daysSinceLastBan)!) }
        : {}),
    };
  if (Array.isArray(p.recentGames))
    out.recentGames = p.recentGames
      .map(obj)
      .map((g) => {
        const appId = int(g.appId, 1, 1e10);
        const name = cleanText(g.name, 128);
        const h = num(g.playtime2WeeksHours);
        const iconUrl = safeImageUrl(g.iconUrl);
        return appId && name && h !== undefined
          ? {
              appId,
              name,
              playtime2WeeksHours: h,
              ...(iconUrl ? { iconUrl } : {}),
            }
          : null;
      })
      .filter((g) => g !== null)
      .slice(0, 5);
  return orderProfile(out as SteamProfile);
}
