import type { ProfilePart, RecentGame } from "./steam-profile.types.js";
import {
  CS2_APP_ID,
  TIMEOUT_MS,
  arr,
  cleanText,
  hours,
  int,
  obj,
  personaStates,
  readCapped,
  safeImageUrl,
  safeProfileUrl,
  unixIso,
} from "./steam-text.js";

type Json = Record<string, unknown>;
const appIcon = (appId: number, hash: unknown): string | undefined =>
  typeof hash === "string" && /^[0-9a-f]{40}$/.test(hash)
    ? safeImageUrl(
        `https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/${appId}/${hash}.jpg`,
      )
    : undefined;

async function webApi(
  fetchImpl: typeof fetch,
  key: string,
  path: string,
  params: Record<string, string>,
): Promise<Json> {
  const url = new URL(`https://api.steampowered.com/${path}`);
  url.searchParams.set("key", key);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  let response: Response;
  try {
    response = await fetchImpl(url.toString(), {
      redirect: "error",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: "application/json" },
    });
  } catch {
    // Never propagate the URL (it carries the key).
    throw new Error(`Steam Web API ${path.split("/")[1]} unreachable`);
  }
  if (!response.ok)
    throw new Error(
      `Steam Web API ${path.split("/")[1]} HTTP ${response.status}`,
    );
  return obj(JSON.parse(await readCapped(response)));
}

/** Profile fields from the Steam Web API (needs a key); null when every call failed. */
export async function fromWebApi(
  fetchImpl: typeof fetch,
  key: string,
  steamId: string,
): Promise<ProfilePart | null> {
  const call = (path: string, params: Record<string, string>): Promise<Json> =>
    webApi(fetchImpl, key, path, params);
  const [summaries, level, owned, recent, bans, badges, friends] =
    await Promise.allSettled([
      call("ISteamUser/GetPlayerSummaries/v2/", { steamids: steamId }),
      call("IPlayerService/GetSteamLevel/v1/", { steamid: steamId }),
      call("IPlayerService/GetOwnedGames/v1/", {
        steamid: steamId,
        include_played_free_games: "1",
        include_appinfo: "0",
        "appids_filter[0]": String(CS2_APP_ID),
      }),
      call("IPlayerService/GetRecentlyPlayedGames/v1/", {
        steamid: steamId,
        count: "5",
      }),
      call("ISteamUser/GetPlayerBans/v1/", { steamids: steamId }),
      call("IPlayerService/GetBadges/v1/", { steamid: steamId }),
      call("ISteamUser/GetFriendList/v1/", {
        steamid: steamId,
        relationship: "friend",
      }),
    ]);
  const value = (r: PromiseSettledResult<Json>): Json | undefined =>
    r.status === "fulfilled" ? r.value : undefined;
  const out: ProfilePart = {};
  let any = false;
  const player = arr(obj(value(summaries)?.response).players)
    .map(obj)
    .find((p) => p.steamid === steamId);
  if (player) {
    any = true;
    const personaName = cleanText(player.personaname, 64);
    if (personaName) out.personaName = personaName;
    const realName = cleanText(player.realname, 64);
    if (realName) out.realName = realName;
    const avatarUrl = safeImageUrl(player.avatarfull);
    if (avatarUrl) out.avatarUrl = avatarUrl;
    const avatarMediumUrl = safeImageUrl(player.avatarmedium);
    if (avatarMediumUrl) out.avatarMediumUrl = avatarMediumUrl;
    const profileUrl = safeProfileUrl(player.profileurl);
    if (profileUrl) out.profileUrl = profileUrl;
    if (
      typeof player.loccountrycode === "string" &&
      /^[A-Z]{2}$/.test(player.loccountrycode)
    )
      out.countryCode = player.loccountrycode;
    const since = unixIso(player.timecreated);
    if (since) out.steamMemberSince = since;
    const logoff = unixIso(player.lastlogoff);
    if (logoff) out.lastLogoff = logoff;
    const state = int(player.personastate, 0, 6);
    const game = cleanText(player.gameextrainfo, 128);
    if (game) {
      out.personaState = "in-game";
      out.currentGame = game;
    } else if (state !== undefined) out.personaState = personaStates[state];
    // Friends-only and private both report 1 to non-friends; the XML tells them apart.
    out.visibility =
      int(player.communityvisibilitystate) === 3 ? "public" : "private";
  }
  const steamLevel = int(obj(value(level)?.response).player_level, 0, 100000);
  if (steamLevel !== undefined) {
    any = true;
    out.steamLevel = steamLevel;
  }
  const cs2 = arr(obj(value(owned)?.response).games)
    .map(obj)
    .find((g) => g.appid === CS2_APP_ID);
  if (cs2) {
    const total = hours(cs2.playtime_forever);
    const twoWeeks = hours(cs2.playtime_2weeks ?? 0);
    if (total !== undefined) {
      any = true;
      out.cs2 = {
        playtimeHours: total,
        ...(twoWeeks !== undefined ? { playtime2WeeksHours: twoWeeks } : {}),
      };
    }
  }
  const recentBody = value(recent);
  if (recentBody) {
    const games: RecentGame[] = [];
    for (const g of arr(obj(recentBody.response).games).map(obj)) {
      const appId = int(g.appid, 1, 1e10);
      const name = cleanText(g.name, 128);
      const twoWeeks = hours(g.playtime_2weeks);
      if (!appId || !name || twoWeeks === undefined) continue;
      const iconUrl = appIcon(appId, g.img_icon_url);
      games.push({
        appId,
        name,
        playtime2WeeksHours: twoWeeks,
        ...(iconUrl ? { iconUrl } : {}),
      });
      if (games.length === 5) break;
    }
    if (obj(recentBody.response).total_count !== undefined || games.length) {
      any = true;
      out.recentGames = games;
    }
  }
  const ban = arr(value(bans)?.players)
    .map(obj)
    .find((b) => b.SteamId === steamId);
  if (ban) {
    any = true;
    const days = int(ban.DaysSinceLastBan, 0, 100000);
    const vacBans = int(ban.NumberOfVACBans, 0, 1000) ?? 0;
    const gameBans = int(ban.NumberOfGameBans, 0, 1000) ?? 0;
    out.bans = {
      vacBans,
      gameBans,
      communityBanned: ban.CommunityBanned === true,
      ...(days !== undefined && (vacBans > 0 || gameBans > 0)
        ? { daysSinceLastBan: days }
        : {}),
    };
  }
  const badgeList = obj(value(badges)?.response).badges;
  if (Array.isArray(badgeList)) {
    any = true;
    out.badgesCount = Math.min(badgeList.length, 100000);
  }
  const friendList = obj(value(friends)?.friendslist).friends;
  if (Array.isArray(friendList)) {
    any = true;
    out.friendsCount = Math.min(friendList.length, 100000);
  }
  return any ? out : null;
}
