/**
 * Steam links and console commands for practice resources. The only URLs the training layer
 * produces are `steam://` links and https://steamcommunity.com pages (tested allowlist): the
 * browser cannot start a map inside CS2, so the UI opens Steam and copies exact commands.
 */
import type { CatalogEntry } from "./catalog.js";

const WORKSHOP_ID = /^[0-9]{6,12}$/;

/** steam:// opens the Workshop page in the Steam client. */
export const workshopSteamUrl = (id: string): string =>
  `steam://url/CommunityFilePage/${id}`;
/** https fallback when the Steam client is not installed. */
export const workshopWebUrl = (id: string): string =>
  `https://steamcommunity.com/sharedfiles/filedetails/?id=${id}`;
/** Starts CS2 (app 730) through Steam. */
export const LAUNCH_CS2_URL = "steam://rungameid/730";

/**
 * Loads a subscribed Workshop map from the CS2 console (gamedll command "Get the latest version
 * of the map and host it on this server"); see docs/COACHING_METHOD.md for sources.
 */
export const workshopMapCommand = (id: string): string =>
  `host_workshop_map ${id}`;

export type ResourceLinks = {
  /** steam://url/CommunityFilePage/<id> (Workshop entries). */
  steam?: string;
  /** https://steamcommunity.com/sharedfiles/filedetails/?id=<id> (Workshop entries). */
  web?: string;
  /** steam://rungameid/730. */
  launch: string;
  /** Console command to load the map (Workshop entries, after subscribing). */
  command?: string;
};

export function resourceLinks(entry: CatalogEntry): ResourceLinks {
  const id = entry.workshopId;
  if (!id || !WORKSHOP_ID.test(id)) return { launch: LAUNCH_CS2_URL };
  return {
    steam: workshopSteamUrl(id),
    web: workshopWebUrl(id),
    launch: LAUNCH_CS2_URL,
    command: workshopMapCommand(id),
  };
}

/** True for the only link shapes the training layer may emit. */
export function isAllowedTrainingUrl(url: string): boolean {
  if (/^steam:\/\/rungameid\/730$/.test(url)) return true;
  if (/^steam:\/\/url\/CommunityFilePage\/[0-9]{6,12}$/.test(url)) return true;
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      u.hostname === "steamcommunity.com" &&
      u.port === "" &&
      u.username === "" &&
      u.password === ""
    );
  } catch {
    return false;
  }
}
