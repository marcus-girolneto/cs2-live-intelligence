/**
 * Public Steam profile for the signed-in account. Works without any key through the public
 * community XML profile; a Steam Web API key (STEAM_WEB_API_KEY) adds level, playtime, bans,
 * recent games, badges and friends. Every source is independent: one failing never breaks
 * the others. Values are validated and clamped; URLs are allowlisted; the key never leaves
 * this module (not in results, errors or logs).
 */
export type PersonaState =
  | "online"
  | "offline"
  | "busy"
  | "away"
  | "snooze"
  | "looking to trade"
  | "looking to play"
  | "in-game";
export type Visibility = "public" | "friends" | "private";
export type RecentGame = {
  appId: number;
  name: string;
  playtime2WeeksHours: number;
  iconUrl?: string;
};
export type SteamProfile = {
  personaName: string;
  realName?: string;
  avatarUrl?: string;
  avatarMediumUrl?: string;
  profileUrl?: string;
  countryCode?: string;
  location?: string;
  summary?: string;
  steamMemberSince?: string;
  steamLevel?: number;
  personaState?: PersonaState;
  currentGame?: string;
  lastLogoff?: string;
  visibility: Visibility;
  cs2?: { playtimeHours: number; playtime2WeeksHours?: number };
  bans?: {
    vacBans: number;
    gameBans: number;
    communityBanned: boolean;
    daysSinceLastBan?: number;
  };
  recentGames?: RecentGame[];
  friendsCount?: number;
  badgesCount?: number;
  groupsCount?: number;
  fetchedAt: string;
};
/** Fields one source contributed (merged into a SteamProfile). */
export type ProfilePart = Omit<
  globalThis.Partial<SteamProfile>,
  "cs2" | "bans" | "fetchedAt"
> & {
  cs2?: SteamProfile["cs2"];
  bans?: SteamProfile["bans"];
};
