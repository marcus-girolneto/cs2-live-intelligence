import type {
  ProfilePart,
  RecentGame,
  Visibility,
} from "./steam-profile.types.js";
import {
  CS2_APP_ID,
  cleanText,
  decodeEntities,
  htmlToText,
  int,
  parseMemberSince,
  safeImageUrl,
  safeProfileUrl,
} from "./steam-text.js";

/**
 * Value of a <tag> inside `xml`, entity-decoded once. Steam HTML-escapes text even inside
 * CDATA (e.g. "&lt;3"), so CDATA is decoded too unless `raw` (HTML fields like the bio).
 */
function tag(xml: string, name: string, raw = false): string | undefined {
  const m = new RegExp(
    `<${name}>(?:\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*|([^<]*))</${name}>`,
  ).exec(xml);
  if (!m) return undefined;
  if (m[1] !== undefined) return raw ? m[1] : decodeEntities(m[1]);
  return raw ? (m[2] ?? "") : decodeEntities(m[2] ?? "");
}
function section(
  xml: string,
  name: string,
): { inner: string | undefined; rest: string } {
  const start = xml.indexOf(`<${name}>`);
  if (start < 0) return { inner: undefined, rest: xml };
  const end = xml.indexOf(`</${name}>`, start);
  const stop = end < 0 ? xml.length : end + name.length + 3;
  return {
    inner: xml.slice(start + name.length + 2, end < 0 ? xml.length : end),
    rest: xml.slice(0, start) + xml.slice(stop),
  };
}

export function parseProfileXml(
  xml: string,
  steamId: string,
): ProfilePart | null {
  // Never process DTDs or custom entities.
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) return null;
  if (!/<profile>/.test(xml)) return null;
  let body = xml;
  const games = section(body, "mostPlayedGames");
  body = games.rest;
  const groups = section(body, "groups");
  body = groups.rest;
  if (tag(body, "steamID64")?.trim() !== steamId) return null;
  const personaName = cleanText(tag(body, "steamID"), 64);
  if (!personaName) return null;
  const privacy = tag(body, "privacyState")?.trim().toLowerCase();
  const visibility: Visibility =
    privacy === "public"
      ? "public"
      : privacy === "friendsonly"
        ? "friends"
        : "private";
  const result: ProfilePart = { personaName, visibility };
  const avatarUrl = safeImageUrl(tag(body, "avatarFull"));
  if (avatarUrl) result.avatarUrl = avatarUrl;
  const avatarMediumUrl = safeImageUrl(tag(body, "avatarMedium"));
  if (avatarMediumUrl) result.avatarMediumUrl = avatarMediumUrl;
  const custom = tag(body, "customURL")?.trim();
  result.profileUrl =
    (custom && safeProfileUrl(`https://steamcommunity.com/id/${custom}/`)) ||
    `https://steamcommunity.com/profiles/${steamId}/`;
  const realName = cleanText(tag(body, "realname"), 64);
  if (realName) result.realName = realName;
  const location = cleanText(tag(body, "location"), 128);
  if (location) result.location = location;
  const summary = htmlToText(tag(body, "summary", true));
  if (summary) result.summary = summary;
  const since = parseMemberSince(tag(body, "memberSince"));
  if (since) result.steamMemberSince = since;
  const online = tag(body, "onlineState")?.trim().toLowerCase();
  const message = tag(body, "stateMessage", true) ?? "";
  if (online === "in-game") {
    result.personaState = "in-game";
    const game = cleanText(
      htmlToText(message.replace(/^\s*In-Game\s*(<br\s*\/?>)?/i, ""), 128),
      128,
    );
    if (game) result.currentGame = game;
  } else if (online === "online") result.personaState = "online";
  else if (online === "offline") result.personaState = "offline";
  const vac = tag(body, "vacBanned")?.trim();
  if (vac === "0" || vac === "1")
    // The XML only flags whether any VAC ban exists; counts need the Web API.
    result.bans = {
      vacBans: vac === "1" ? 1 : 0,
      gameBans: 0,
      communityBanned: false,
    };
  if (groups.inner !== undefined)
    result.groupsCount = Math.min(
      (groups.inner.match(/<group[\s>]/g) ?? []).length,
      100000,
    );
  if (games.inner) {
    const recent: RecentGame[] = [];
    for (const block of games.inner.match(
      /<mostPlayedGame>[\s\S]*?<\/mostPlayedGame>/g,
    ) ?? []) {
      const appId = int(
        /\/app\/([0-9]{1,10})/.exec(tag(block, "gameLink") ?? "")?.[1],
        1,
        1e10,
      );
      const name = cleanText(tag(block, "gameName"), 128);
      const twoWeeks = Number(
        (tag(block, "hoursPlayed") ?? "").replace(/,/g, ""),
      );
      const total = Number(
        (tag(block, "hoursOnRecord") ?? "").replace(/,/g, ""),
      );
      if (!appId || !name) continue;
      if (appId === CS2_APP_ID && Number.isFinite(total) && total >= 0)
        result.cs2 = {
          playtimeHours: Math.round(total * 10) / 10,
          ...(Number.isFinite(twoWeeks) && twoWeeks >= 0
            ? { playtime2WeeksHours: Math.round(twoWeeks * 10) / 10 }
            : {}),
        };
      if (Number.isFinite(twoWeeks) && twoWeeks > 0 && recent.length < 5) {
        const iconUrl = safeImageUrl(tag(block, "gameIcon"));
        recent.push({
          appId,
          name,
          playtime2WeeksHours: Math.round(twoWeeks * 10) / 10,
          ...(iconUrl ? { iconUrl } : {}),
        });
      }
    }
    if (recent.length) result.recentGames = recent;
  }
  return result;
}
