import { isIP } from "node:net";
import type { CreditSettings, WelcomeReason } from "./credits.dto.js";

/** What the welcome rules read from the cached Steam profile. */
export type WelcomeProfile = {
  visibility: "public" | "friends" | "private";
  steamMemberSince?: string;
  bans?: { vacBans: number; gameBans: number };
};
export type WelcomeDecision =
  | { status: "eligible" }
  | { status: "pending" | "ineligible"; reason: WelcomeReason };

const DAY_MS = 86_400_000;
/** Reasons that may change later (re-evaluated on later sign-ins and profile refreshes). */
export const RETRIABLE: ReadonlySet<WelcomeReason> = new Set([
  "profile_private",
  "profile_unavailable",
  "account_too_new",
  "network_limit",
  "disabled",
  "not_evaluated",
]);

/**
 * Policy object for welcome credits (pure). In order:
 * 1. no profile could be read → pending (profile_unavailable);
 * 2. VAC or game bans on record → ineligible (banned); unknown bans (no Web API key) pass;
 * 3. profile not public or Steam account age unknown → pending (profile_private);
 * 4. Steam account younger than minSteamAgeDays → ineligible (account_too_new, re-checked);
 * 5. otherwise eligible (the once-per-Steam-id and per-network limits are checked atomically
 *    when granting).
 */
export const WelcomePolicy = {
  decide(
    profile: WelcomeProfile | undefined,
    settings: Pick<CreditSettings, "minSteamAgeDays">,
    now: Date,
  ): WelcomeDecision {
    if (!profile) return { status: "pending", reason: "profile_unavailable" };
    if (profile.bans && (profile.bans.vacBans > 0 || profile.bans.gameBans > 0))
      return { status: "ineligible", reason: "banned" };
    const since = profile.steamMemberSince
      ? Date.parse(profile.steamMemberSince)
      : NaN;
    if (profile.visibility !== "public" || !Number.isFinite(since))
      return { status: "pending", reason: "profile_private" };
    if (now.getTime() - since < settings.minSteamAgeDays * DAY_MS)
      return { status: "ineligible", reason: "account_too_new" };
    return { status: "eligible" };
  },

  /**
   * The sign-in network: "a.b.c.0/24" for IPv4 (also IPv4-mapped IPv6), the first three
   * hextets "/48" for IPv6; undefined for anything else.
   */
  networkPrefix(ip: string | undefined): string | undefined {
    if (!ip) return undefined;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip)?.[1];
    const v4 = mapped ?? (isIP(ip) === 4 ? ip : undefined);
    if (v4) return `${v4.split(".").slice(0, 3).join(".")}.0/24`;
    if (isIP(ip) !== 6) return undefined;
    const [head, tail = ""] = ip.toLowerCase().split("::");
    const left = head ? head.split(":") : [];
    const right = tail ? tail.split(":") : [];
    const full = ip.includes("::")
      ? [...left, ...Array(8 - left.length - right.length).fill("0"), ...right]
      : left;
    return `${full
      .slice(0, 3)
      .map((h) => (parseInt(h || "0", 16) || 0).toString(16))
      .join(":")}::/48`;
  },
};
