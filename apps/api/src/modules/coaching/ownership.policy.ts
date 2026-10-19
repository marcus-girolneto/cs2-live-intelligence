/**
 * Whether a processed demo is the account's own match. Order: (1) the account's Steam ID is a
 * player of the demo → "mine" (steam); (2) the account's saved identity choice for that match
 * ("this is me", PUT /v1/coach/identity, or a manual override) → "mine" (chosen/user);
 * (3) otherwise "external". A manual "Not my match" override is kept as "external" (user).
 * Never assumed: no Steam match and no choice means external.
 */
export type Ownership = "mine" | "external";
export type MatchedBy = "steam" | "chosen" | "user" | "none";
export type OwnershipRecord = {
  jobId: string;
  ownerId: string;
  ownership: Ownership;
  playerSteamId: string | null;
  matchedBy: MatchedBy;
  updatedAt?: string;
};
export type AccountIdentity = {
  /** The account's own SteamID64 (Steam sign-in), when linked. */
  steamId: string | null;
  /** Legacy account-wide "this is me" choice (non-Steam accounts). */
  chosenSteamId: string | null;
};

export function classifyOwnership(
  players: { steamId: string }[],
  account: AccountIdentity,
  previous?: Pick<
    OwnershipRecord,
    "ownership" | "playerSteamId" | "matchedBy"
  > | null,
): Pick<OwnershipRecord, "ownership" | "playerSteamId" | "matchedBy"> {
  const has = (id: string | null): id is string =>
    !!id && players.some((p) => p.steamId === id);
  if (has(account.steamId))
    return {
      ownership: "mine",
      playerSteamId: account.steamId,
      matchedBy: "steam",
    };
  if (previous?.matchedBy === "user")
    return previous.ownership === "mine" && !has(previous.playerSteamId)
      ? { ownership: "external", playerSteamId: null, matchedBy: "none" }
      : previous;
  if (previous?.matchedBy === "chosen" && has(previous.playerSteamId))
    return previous;
  if (has(account.chosenSteamId))
    return {
      ownership: "mine",
      playerSteamId: account.chosenSteamId,
      matchedBy: "chosen",
    };
  return { ownership: "external", playerSteamId: null, matchedBy: "none" };
}
