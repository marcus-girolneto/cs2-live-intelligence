import { readCapped, steamIdPattern, TIMEOUT_MS } from "./steam-text.js";

/** Ban counts of one account (ISteamUser/GetPlayerBans/v1). */
export interface PlayerBans {
  steamId: string;
  vacBans: number;
  gameBans: number;
  daysSinceLastBan: number;
}

/** Port: ban counts for up to any number of Steam ids (batched by the adapter). */
export interface PlayerBansSource {
  /** Undefined when no Steam Web API key is configured. */
  bans(steamIds: string[]): Promise<Map<string, PlayerBans> | undefined>;
}

const BATCH = 100;
const CACHE_MS = 24 * 3600_000;
const MIN_INTERVAL_MS = 1100;
const MAX_CALLS_PER_HOUR = 600;

const count = (v: unknown): number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v < 1e6 ? v : 0;

/**
 * Adapter over ISteamUser/GetPlayerBans/v1 (100 ids per call): 24 h cache per Steam id,
 * calls spaced ≥ 1.1 s apart and at most 600 per hour (well under Steam's 100k/day). The key
 * comes from the admin-managed integrations (env fallback) and never appears in errors.
 */
export class SteamPlayerBans implements PlayerBansSource {
  private readonly cache = new Map<string, { at: number; bans: PlayerBans }>();
  private chain: Promise<unknown> = Promise.resolve();
  private lastCall = Number.NEGATIVE_INFINITY;
  private calls: number[] = [];

  constructor(
    private readonly key: () => Promise<string | undefined>,
    private readonly fetchImpl: () => typeof fetch = () => fetch,
    private readonly now: () => number = Date.now,
    private readonly sleep: (ms: number) => Promise<void> = (ms) =>
      new Promise((r) => setTimeout(r, ms)),
  ) {}

  async bans(steamIds: string[]): Promise<Map<string, PlayerBans> | undefined> {
    const key = await this.key();
    if (!key) return undefined;
    const ids = [...new Set(steamIds.filter((id) => steamIdPattern.test(id)))];
    const out = new Map<string, PlayerBans>();
    const missing: string[] = [];
    for (const id of ids) {
      const hit = this.cache.get(id);
      if (hit && this.now() - hit.at < CACHE_MS) out.set(id, hit.bans);
      else missing.push(id);
    }
    for (let i = 0; i < missing.length; i += BATCH)
      for (const bans of await this.call(key, missing.slice(i, i + BATCH))) {
        this.cache.set(bans.steamId, { at: this.now(), bans });
        out.set(bans.steamId, bans);
      }
    if (this.cache.size > 50_000) this.cache.clear();
    return out;
  }

  /** One rate-limited request (requests are serialized through `chain`). */
  private call(key: string, ids: string[]): Promise<PlayerBans[]> {
    const run = async (): Promise<PlayerBans[]> => {
      const hourAgo = this.now() - 3600_000;
      this.calls = this.calls.filter((t) => t > hourAgo);
      if (this.calls.length >= MAX_CALLS_PER_HOUR)
        throw new Error("Steam ban check rate limit reached");
      const wait = this.lastCall + MIN_INTERVAL_MS - this.now();
      if (wait > 0) await this.sleep(wait);
      this.lastCall = this.now();
      this.calls.push(this.lastCall);
      const url = new URL(
        "https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/",
      );
      url.searchParams.set("key", key);
      url.searchParams.set("steamids", ids.join(","));
      let response: Response;
      try {
        response = await this.fetchImpl()(url.toString(), {
          redirect: "error",
          signal: AbortSignal.timeout(TIMEOUT_MS),
          headers: { accept: "application/json" },
        });
      } catch {
        throw new Error("Steam GetPlayerBans unreachable");
      }
      if (!response.ok)
        throw new Error(`Steam GetPlayerBans HTTP ${response.status}`);
      const body = JSON.parse(await readCapped(response)) as {
        players?: unknown;
      };
      const players = Array.isArray(body.players) ? body.players : [];
      return players.flatMap((raw): PlayerBans[] => {
        const p = raw as Record<string, unknown>;
        const steamId = String(p.SteamId ?? "");
        if (!ids.includes(steamId)) return [];
        return [
          {
            steamId,
            vacBans: count(p.NumberOfVACBans),
            gameBans: count(p.NumberOfGameBans),
            daysSinceLastBan: count(p.DaysSinceLastBan),
          },
        ];
      });
    };
    const result = this.chain.then(run, run);
    this.chain = result.catch(() => undefined);
    return result;
  }
}
