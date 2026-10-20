/**
 * Workshop verification: compares Steam's public GetPublishedFileDetails answer with the
 * catalog. Pure functions here; `verify-cli.ts` (pnpm training:verify) does the network call
 * and writes the committed snapshot `catalog.verified.json`.
 */
import type { CatalogEntry } from "./catalog.js";

export const STEAM_DETAILS_URL =
  "https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/";

/** The fields of one GetPublishedFileDetails item the verifier reads. */
export type SteamFileDetails = {
  publishedfileid: string;
  result: number;
  title?: string;
  consumer_app_id?: number;
  banned?: number | boolean;
  time_updated?: number;
  lifetime_subscriptions?: number;
  tags?: { tag: string }[];
};

export type VerifiedRecord = {
  workshopId: string;
  title: string;
  consumerAppId: number | null;
  banned: boolean;
  cs2: boolean;
  subscriptions: number | null;
  timeUpdated: number | null;
  ok: boolean;
  problems: string[];
};
export type VerifiedSnapshot = {
  source: string;
  verifiedAt: string;
  records: VerifiedRecord[];
};

const norm = (s: string) => s.normalize("NFKC").replace(/\s+/g, " ").trim();

/** Checks one entry against Steam's answer: same title, app 730, not banned/removed, CS2 tag. */
export function verifyEntry(
  entry: CatalogEntry,
  details: SteamFileDetails | undefined,
): VerifiedRecord {
  const workshopId = entry.workshopId ?? "";
  const problems: string[] = [];
  if (!details || details.result !== 1) problems.push("not found or removed");
  const title = details?.title ?? "";
  if (details && norm(title) !== norm(entry.workshopTitle ?? entry.title))
    problems.push(`title is "${title}"`);
  const app = details?.consumer_app_id ?? null;
  if (details && app !== 730) problems.push(`consumer_app_id ${app}`);
  const banned = !!details?.banned;
  if (banned) problems.push("banned");
  const cs2 = !!details?.tags?.some((t) => t.tag.toLowerCase() === "cs2");
  if (details && !cs2) problems.push("no CS2 tag");
  return {
    workshopId,
    title,
    consumerAppId: app,
    banned,
    cs2,
    subscriptions: details?.lifetime_subscriptions ?? null,
    timeUpdated: details?.time_updated ?? null,
    ok: problems.length === 0,
    problems,
  };
}

/** Form body of a GetPublishedFileDetails request (POST, no key needed). */
export function detailsRequestBody(ids: string[]): URLSearchParams {
  const body = new URLSearchParams({ itemcount: String(ids.length) });
  ids.forEach((id, i) => body.set(`publishedfileids[${i}]`, id));
  return body;
}

/** JSON with every non-ASCII character escaped (the repo's copy check forbids raw dashes). */
export const asciiJson = (value: unknown): string =>
  JSON.stringify(value, null, 2).replace(
    /[\u0080-￿]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`,
  ) + "\n";
