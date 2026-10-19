import type { RuntimeEnv } from "../../config/env.js";
import type { SteamOpenIdVerifier } from "../../infrastructure/steam/http-steam-client.js";
import type { OwnerInvalidation } from "../live/owner-invalidation.js";
import type { AuthRepository } from "./auth.repository.js";
import { parseSteamAssertion, steamLoginUrl } from "./openid.js";

/** Port: refreshes the cached Steam profile (users module) after a sign-in. */
export interface ProfileRefresher {
  refreshInBackground(ownerId: string, steamId: string): void;
}

/** Port (credits): told about every successful Steam sign-in (welcome credit evaluation). */
export interface SignInListener {
  signedIn(ownerId: string, steamId: string, ip: string | undefined): void;
}

export type SteamLoginResult =
  | { status: "ok"; code: string; binding: string }
  | { status: "rejected" }
  | { status: "unavailable" };

/** Steam OpenID sign-in, login-code exchange and logout. */
export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly steam: SteamOpenIdVerifier,
    private readonly profiles: ProfileRefresher,
    private readonly invalidation: OwnerInvalidation,
    private readonly env: RuntimeEnv,
    private readonly apiPublicUrl: string,
    private readonly now: () => number = Date.now,
    private readonly signIns?: SignInListener,
  ) {}

  /** A new login attempt: the state (for the cookie) and Steam's login URL. */
  async startSteamLogin(): Promise<{ state: string; url: string }> {
    const state = await this.repository.createOpenIdState();
    return { state, url: steamLoginUrl(this.apiPublicUrl, state) };
  }

  async completeSteamLogin(
    query: Record<string, string>,
    stateCookie: string | undefined,
    ip?: string,
  ): Promise<SteamLoginResult> {
    const assertion = parseSteamAssertion(
      query,
      stateCookie,
      this.apiPublicUrl,
      this.now(),
    );
    if (!assertion) return { status: "rejected" };
    const verdict = await this.steam.verify(assertion.verification);
    if (verdict === "unavailable") return { status: "unavailable" };
    if (verdict === "invalid") return { status: "rejected" };
    const login = await this.repository.finishOpenId(
      assertion.state,
      assertion.nonce,
      assertion.steamId,
      this.env.adminBootstrap(),
    );
    if (!login) return { status: "rejected" };
    // Refresh the cached Steam profile in the background; /v1/me joins it if still running.
    this.profiles.refreshInBackground(login.ownerId, assertion.steamId);
    this.signIns?.signedIn(login.ownerId, assertion.steamId, ip);
    return { status: "ok", code: login.code, binding: login.binding };
  }

  exchange(
    code: string,
    binding: string,
  ): Promise<{ token: string } | undefined> {
    return this.repository.exchange(code, binding);
  }

  /** Revokes the session token and closes the owner's live channels. */
  async logout(token: string, ownerId: string): Promise<void> {
    await this.repository.logout(token);
    this.invalidation.invalidate(ownerId);
  }
}
