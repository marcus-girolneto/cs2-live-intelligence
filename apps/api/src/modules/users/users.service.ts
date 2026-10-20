import type { LanguageCode } from "@cs2/contracts/languages";
import type { SteamProfileProvider } from "../../infrastructure/steam/http-steam-client.js";
import type { SteamProfile } from "../../infrastructure/steam/steam-profile.types.js";
import { sanitizeStoredProfile } from "../../infrastructure/steam/sanitize-profile.js";
import { TooManyRequestsError } from "../../shared/errors/index.js";
import type { ProfileRefresher } from "../auth/auth.service.js";
import type { MeDto } from "./users.dto.js";
import type { UsersRepository } from "./users.repository.js";

/** Cached Steam profiles are refreshed when older than this. */
export const PROFILE_MAX_AGE_MS = 6 * 60 * 60 * 1000;
/** Minimum time between forced refreshes per account (and between retries after a failure). */
export const PROFILE_REFRESH_INTERVAL_MS = 60 * 1000;
const MAX_TRACKED = 10000;

/** Port: extra GET /v1/me fields contributed by other modules (plan, usage, credits). */
export interface AccountExtras {
  extras(
    ownerId: string,
    account: { steamLinked: boolean },
  ): Promise<Record<string, unknown>>;
}
/** Port (credits): told about every successful profile refresh of a Steam account. */
export interface ProfileListener {
  profileRefreshed(
    ownerId: string,
    steamId: string,
    profile: SteamProfile,
  ): void;
}

/**
 * GET /v1/me and the cached public Steam profile. Steam is asked again when the cache is
 * stale (6 h), at most once per minute per account after a failure; concurrent requests
 * share one in-flight refresh; Steam outages serve the cache.
 */
export class UsersService implements ProfileRefresher {
  private readonly inflight = new Map<string, Promise<boolean>>();
  private readonly failedAt = new Map<string, number>();
  private readonly forcedAt = new Map<string, number>();
  constructor(
    private readonly users: UsersRepository,
    private readonly steam: SteamProfileProvider,
    private readonly extras: AccountExtras | undefined,
    private readonly now: () => number = Date.now,
    private listener?: ProfileListener,
  ) {}

  /** Late binding (the credits module is built after this one). */
  onProfileRefreshed(listener: ProfileListener): void {
    this.listener = listener;
  }

  /** ProfileSource (welcome credits): refreshes now (sharing an in-flight refresh), then reads the cache. */
  async freshProfile(
    ownerId: string,
    steamId: string,
  ): Promise<SteamProfile | undefined> {
    await this.refreshProfile(ownerId, steamId);
    const account = await this.users.account(ownerId);
    return account.steamId === steamId
      ? sanitizeStoredProfile(account.steamProfile)
      : undefined;
  }

  me(ownerId: string): Promise<MeDto> {
    return this.view(ownerId, "auto");
  }

  /** PUT /v1/me/language: the interface and AI language the user picked. */
  async setLanguage(ownerId: string, lang: LanguageCode): Promise<void> {
    await this.users.setLanguage(ownerId, lang);
  }

  /** Forced refresh, rate limited per account (429 with retry-after). */
  async refresh(ownerId: string): Promise<MeDto> {
    const last = this.forcedAt.get(ownerId);
    const wait = last ? PROFILE_REFRESH_INTERVAL_MS - (this.now() - last) : 0;
    if (wait > 0) {
      const retryAfterSeconds = Math.ceil(wait / 1000);
      throw new TooManyRequestsError(
        "The Steam profile was refreshed recently; try again shortly.",
        {
          details: { retryAfterSeconds },
          headers: { "retry-after": String(retryAfterSeconds) },
        },
      );
    }
    this.prune(this.forcedAt);
    this.forcedAt.set(ownerId, this.now());
    return this.view(ownerId, "force");
  }

  refreshInBackground(ownerId: string, steamId: string): void {
    void this.refreshProfile(ownerId, steamId);
  }

  /** Waits for in-flight refreshes (shutdown). */
  async drain(): Promise<void> {
    await Promise.allSettled([...this.inflight.values()]);
  }

  private async view(
    ownerId: string,
    refresh: "auto" | "force",
  ): Promise<MeDto> {
    let account = await this.users.account(ownerId);
    if (
      account.steamId &&
      this.shouldRefresh(account.steamProfileFetchedAt, ownerId, refresh)
    )
      if (await this.refreshProfile(ownerId, account.steamId))
        account = await this.users.account(ownerId);
    const profile = account.steamId
      ? sanitizeStoredProfile(account.steamProfile)
      : undefined;
    return {
      ownerId: account.ownerId,
      role: account.role,
      ...(account.steamId ? { steamId: account.steamId } : {}),
      ...(account.memberSince ? { memberSince: account.memberSince } : {}),
      ...(account.lang ? { lang: account.lang } : {}),
      ...(profile ? { profile } : {}),
      ...(this.extras
        ? await this.extras.extras(ownerId, { steamLinked: !!account.steamId })
        : {}),
    };
  }

  private shouldRefresh(
    fetchedAt: Date | null,
    ownerId: string,
    refresh: "auto" | "force",
  ): boolean {
    const age = fetchedAt ? this.now() - fetchedAt.getTime() : Infinity;
    const recentFailure =
      this.now() - (this.failedAt.get(ownerId) ?? 0) <
      PROFILE_REFRESH_INTERVAL_MS;
    return (
      refresh === "force" ||
      this.inflight.has(ownerId) ||
      (age > PROFILE_MAX_AGE_MS && !recentFailure)
    );
  }

  private refreshProfile(ownerId: string, steamId: string): Promise<boolean> {
    const running = this.inflight.get(ownerId);
    if (running) return running;
    const task = (async () => {
      const profile = await this.steam.profile(steamId);
      if (!profile) {
        this.prune(this.failedAt);
        this.failedAt.set(ownerId, this.now());
        return false;
      }
      await this.users.saveSteamProfile(ownerId, profile);
      this.failedAt.delete(ownerId);
      this.listener?.profileRefreshed(ownerId, steamId, profile);
      return true;
    })()
      .catch(() => false)
      .finally(() => this.inflight.delete(ownerId));
    this.inflight.set(ownerId, task);
    return task;
  }

  private prune(map: Map<string, number>): void {
    if (map.size < MAX_TRACKED) return;
    const now = this.now();
    for (const [key, at] of map)
      if (now - at > PROFILE_REFRESH_INTERVAL_MS) map.delete(key);
    if (map.size >= MAX_TRACKED) map.clear();
  }
}
