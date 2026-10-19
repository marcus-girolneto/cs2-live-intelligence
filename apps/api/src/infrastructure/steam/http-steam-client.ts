import type { SteamProfile } from "./steam-profile.types.js";
import { fetchSteamProfile } from "./steam-profile.js";

export const STEAM_OPENID_ENDPOINT = "https://steamcommunity.com/openid/login";

/** Port: Steam's answer to an OpenID `check_authentication` request. */
export type OpenIdVerdict = "valid" | "invalid" | "unavailable";
export interface SteamOpenIdVerifier {
  verify(fields: URLSearchParams): Promise<OpenIdVerdict>;
}
/** Port: public Steam profile lookup (null when Steam has nothing usable). */
export interface SteamProfileProvider {
  profile(steamId: string): Promise<SteamProfile | null>;
}

/**
 * Adapter for Steam over HTTP: OpenID direct verification and the public profile
 * (community XML + optional Web API). `apiKey` is resolved per call (admin-managed, see the
 * integrations module) so a new or rotated key applies without a restart.
 */
export class HttpSteamClient
  implements SteamOpenIdVerifier, SteamProfileProvider
{
  constructor(
    /** Undefined: the global fetch at call time. */
    private readonly fetchImpl?: typeof fetch,
    private readonly apiKey: () =>
      string | undefined | Promise<string | undefined> = () => undefined,
  ) {}

  async verify(fields: URLSearchParams): Promise<OpenIdVerdict> {
    try {
      const response = await (this.fetchImpl ?? fetch)(STEAM_OPENID_ENDPOINT, {
        method: "POST",
        body: fields,
        redirect: "error",
        signal: AbortSignal.timeout(5000),
      });
      const body = await response.text();
      return response.ok &&
        body.length <= 8192 &&
        body.split(/\r?\n/).includes("is_valid:true")
        ? "valid"
        : "invalid";
    } catch {
      return "unavailable";
    }
  }

  async profile(steamId: string): Promise<SteamProfile | null> {
    let apiKey: string | undefined;
    try {
      apiKey = await this.apiKey();
    } catch {
      apiKey = undefined; // key store unavailable: public community profile only
    }
    return fetchSteamProfile(steamId, { fetch: this.fetchImpl, apiKey });
  }
}
