import { timingSafeEqual } from "node:crypto";
import { STEAM_OPENID_ENDPOINT } from "../../infrastructure/steam/http-steam-client.js";

/** Fields Steam must sign for the assertion to be trusted. */
const REQUIRED_SIGNED = [
  "op_endpoint",
  "claimed_id",
  "identity",
  "return_to",
  "response_nonce",
  "assoc_handle",
];
const NONCE_SKEW_MS = 300000;

export interface OpenIdAssertion {
  state: string;
  steamId: string;
  nonce: string;
  /** The openid.* fields to send back for `check_authentication`. */
  verification: URLSearchParams;
}

/** The callback URL registered as `openid.return_to` for a login attempt. */
export function steamCallbackUrl(apiPublicUrl: string, state: string): string {
  const callback = new URL("/v1/auth/steam/callback", apiPublicUrl);
  callback.searchParams.set("state", state);
  return callback.toString();
}

/** The Steam login URL (OpenID 2.0 checkid_setup) for a fresh state. */
export function steamLoginUrl(apiPublicUrl: string, state: string): string {
  const url = new URL(STEAM_OPENID_ENDPOINT);
  url.search = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": steamCallbackUrl(apiPublicUrl, state),
    "openid.realm": new URL(apiPublicUrl).origin + "/",
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  }).toString();
  return url.toString();
}

function sameState(state: unknown, cookie: unknown): state is string {
  return (
    typeof state === "string" &&
    typeof cookie === "string" &&
    state.length <= 128 &&
    Buffer.byteLength(state) === Buffer.byteLength(cookie) &&
    timingSafeEqual(Buffer.from(state), Buffer.from(cookie))
  );
}

/**
 * Validates a Steam OpenID positive assertion locally (state cookie, endpoint, return_to,
 * claimed id, nonce freshness, signed field list). Returns undefined to reject. Steam must
 * still confirm the signature (check_authentication) before the assertion is trusted.
 */
export function parseSteamAssertion(
  q: Record<string, string>,
  stateCookie: string | undefined,
  apiPublicUrl: string,
  now: number,
): OpenIdAssertion | undefined {
  const state = q.state;
  if (!sameState(state, stateCookie)) return undefined;
  if (
    q["openid.ns"] !== "http://specs.openid.net/auth/2.0" ||
    q["openid.mode"] !== "id_res" ||
    q["openid.op_endpoint"] !== STEAM_OPENID_ENDPOINT ||
    q["openid.return_to"] !== steamCallbackUrl(apiPublicUrl, state)
  )
    return undefined;
  const claimed = q["openid.claimed_id"];
  if (
    typeof claimed !== "string" ||
    !/^https:\/\/steamcommunity\.com\/openid\/id\/[0-9]{17}$/.test(claimed) ||
    q["openid.identity"] !== claimed
  )
    return undefined;
  const nonce = q["openid.response_nonce"];
  if (typeof nonce !== "string" || nonce.length > 256) return undefined;
  const nonceTime = Date.parse(nonce.slice(0, 20));
  if (!Number.isFinite(nonceTime) || Math.abs(now - nonceTime) > NONCE_SKEW_MS)
    return undefined;
  const signed = new Set((q["openid.signed"] ?? "").split(","));
  if (!REQUIRED_SIGNED.every((v) => signed.has(v))) return undefined;
  const verification = new URLSearchParams();
  for (const [key, value] of Object.entries(q))
    if (
      key.startsWith("openid.") &&
      typeof value === "string" &&
      value.length <= 8192
    )
      verification.set(key, value);
  verification.set("openid.mode", "check_authentication");
  return { state, steamId: claimed.split("/").at(-1)!, nonce, verification };
}

/**
 * Why `parseSteamAssertion` refused a response, for operator logs only (no ids or secrets).
 * Mirrors its checks in order.
 */
export function assertionRejectionReason(
  q: Record<string, string>,
  stateCookie: string | undefined,
  apiPublicUrl: string,
  now: number,
): string {
  if (!stateCookie) return "state_cookie_missing";
  if (!sameState(q.state, stateCookie)) return "state_mismatch";
  if (q["openid.mode"] !== "id_res") return "not_id_res";
  if (q["openid.return_to"] !== steamCallbackUrl(apiPublicUrl, q.state))
    return "return_to_mismatch";
  const nonceTime = Date.parse((q["openid.response_nonce"] ?? "").slice(0, 20));
  if (!Number.isFinite(nonceTime) || Math.abs(now - nonceTime) > NONCE_SKEW_MS)
    return "nonce_time";
  return "malformed_response";
}
