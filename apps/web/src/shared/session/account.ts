// The signed-in account, provided by the app gate (composition) and read by every
// feature through useAccount(). Shared so features never import the gate itself.
/** Rich Steam profile returned by GET /v1/me (every field optional except the name). */
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
  personaState?: number | string;
  currentGame?: string;
  lastLogoff?: string;
  visibility?: string;
  cs2?: { playtimeHours?: number; playtime2WeeksHours?: number };
  bans?: {
    vacBans?: number;
    gameBans?: number;
    communityBanned?: boolean;
    daysSinceLastBan?: number;
  };
  recentGames?: {
    appId: number;
    name: string;
    playtime2WeeksHours?: number;
    iconUrl?: string;
  }[];
  friendsCount?: number;
  badgesCount?: number;
  groupsCount?: number;
  fetchedAt?: string;
};
export type Account = {
  ownerId: string;
  steamId?: string;
  memberSince?: string;
  role?: "user" | "admin";
  /** Language saved on the account by the selector (absent until chosen). */
  lang?: string;
  profile?: SteamProfile;
  /** Subscription and daily usage (raw; normalised by the billing feature). */
  plan?: unknown;
  usage?: unknown;
  /** Credit balance, buckets, welcome grant and review costs (raw; normalised by billing). */
  credits?: unknown;
};
