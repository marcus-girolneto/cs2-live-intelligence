import type { ProfilePart, SteamProfile } from "./steam-profile.types.js";
import { fromWebApi } from "./profile-web-api.js";
import { parseProfileXml } from "./profile-xml.js";
import { TIMEOUT_MS, readCapped, steamIdPattern } from "./steam-text.js";

async function fromXml(
  fetchImpl: typeof fetch,
  steamId: string,
): Promise<ProfilePart | null> {
  const response = await fetchImpl(
    `https://steamcommunity.com/profiles/${steamId}/?xml=1`,
    {
      redirect: "error",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: "application/xml,text/xml" },
    },
  );
  if (!response.ok)
    throw new Error(`Steam community profile HTTP ${response.status}`);
  return parseProfileXml(await readCapped(response), steamId);
}

/**
 * Fetches and merges the public XML profile and (with a key) the Web API.
 * Returns null when no source produced a usable profile (Steam unreachable, unknown account).
 */
export async function fetchSteamProfile(
  steamId: string,
  options: { fetch?: typeof fetch; apiKey?: string; now?: Date } = {},
): Promise<SteamProfile | null> {
  if (!steamIdPattern.test(steamId)) return null;
  const fetchImpl = options.fetch ?? fetch;
  const key = options.apiKey?.trim();
  const [xml, api] = await Promise.allSettled([
    fromXml(fetchImpl, steamId),
    key && /^[\x21-\x7e]{8,128}$/.test(key)
      ? fromWebApi(fetchImpl, key, steamId)
      : Promise.resolve(null),
  ]);
  const x = xml.status === "fulfilled" ? xml.value : null;
  const w = api.status === "fulfilled" ? api.value : null;
  const personaName = w?.personaName ?? x?.personaName;
  if (!personaName) return null;
  // Web API values win, except visibility where the XML distinguishes friends-only.
  const merged: ProfilePart = { ...(x ?? {}), ...(w ?? {}) };
  // Presence comes as a pair: the Web API state without a game clears the XML's game.
  if (w?.personaState) merged.currentGame = w.currentGame;
  for (const k of Object.keys(merged) as (keyof ProfilePart)[])
    if (merged[k] === undefined) delete merged[k];
  const profile: SteamProfile = {
    ...merged,
    personaName,
    visibility: x?.visibility ?? w?.visibility ?? "private",
    fetchedAt: (options.now ?? new Date()).toISOString(),
  };
  return orderProfile(profile);
}

/** Stable key order matching the documented shape. */
const ORDER: (keyof SteamProfile)[] = [
  "personaName",
  "realName",
  "avatarUrl",
  "avatarMediumUrl",
  "profileUrl",
  "countryCode",
  "location",
  "summary",
  "steamMemberSince",
  "steamLevel",
  "personaState",
  "currentGame",
  "lastLogoff",
  "visibility",
  "cs2",
  "bans",
  "recentGames",
  "friendsCount",
  "badgesCount",
  "groupsCount",
  "fetchedAt",
];
export function orderProfile(p: SteamProfile): SteamProfile {
  const out: Record<string, unknown> = {};
  for (const k of ORDER) if (p[k] !== undefined) out[k] = p[k];
  return out as SteamProfile;
}
