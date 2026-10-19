import { TooManyRequestsError } from "../../shared/errors/index.js";
import { FixedWindowRateLimiter } from "../../shared/http/rate-limit.js";

export interface UploadRate {
  perAccount: number;
  perNetwork: number;
  windowMs: number;
  capacity: number;
}
/** Upload attempts per minute, on top of the plan's daily quota and the concurrency cap. */
export const UPLOAD_RATE: UploadRate = {
  perAccount: 10,
  perNetwork: 30,
  windowMs: 60_000,
  capacity: 20_000,
};

/**
 * The network an address belongs to for rate limiting: IPv4 /24, IPv6 /48 (IPv4-mapped IPv6
 * addresses count as IPv4). One host cannot dodge the limit by rotating addresses in its LAN
 * or its provider's /48.
 */
export function networkOf(ip: string): string {
  const v4 = /^(?:::ffff:)?(\d+)\.(\d+)\.(\d+)\.\d+$/i.exec(ip);
  if (v4) return `${v4[1]}.${v4[2]}.${v4[3]}.0/24`;
  const [head = ""] = ip.toLowerCase().split("%");
  const [left = "", right] = head.split("::");
  const groups = left ? left.split(":") : [];
  // "::" compresses zero groups; the first three groups are what matters for a /48.
  while (groups.length < 3 && right !== undefined) groups.push("0");
  return `${groups.slice(0, 3).join(":")}::/48`;
}

/**
 * Per-account and per-network fixed windows for POST /v1/demos/uploads. A limited request is
 * answered 429 `upload_rate_limited` with Retry-After (seconds) before any byte is read.
 */
export class UploadRateLimiter {
  private readonly accounts: FixedWindowRateLimiter;
  private readonly networks: FixedWindowRateLimiter;
  constructor(now: () => number = Date.now, rate: UploadRate = UPLOAD_RATE) {
    const window = { windowMs: rate.windowMs, capacity: rate.capacity, now };
    this.accounts = new FixedWindowRateLimiter({
      ...window,
      limit: rate.perAccount,
    });
    this.networks = new FixedWindowRateLimiter({
      ...window,
      limit: rate.perNetwork,
    });
  }

  /** Counts one attempt; throws TooManyRequestsError when either window is exhausted. */
  check(ownerId: string, ip: string | undefined): void {
    this.limit(this.accounts, `owner:${ownerId}`);
    if (ip) this.limit(this.networks, networkOf(ip));
  }

  private limit(limiter: FixedWindowRateLimiter, key: string): void {
    let decision = limiter.hit(key);
    if (decision === "capacity") {
      limiter.prune();
      decision = limiter.hit(key);
    }
    if (decision === "allowed") return;
    const seconds = Math.max(1, Math.ceil(limiter.retryAfterMs(key) / 1000));
    throw new TooManyRequestsError("Too many uploads, try again shortly", {
      code: "upload_rate_limited",
      headers: {
        "retry-after": String(decision === "capacity" ? 60 : seconds),
      },
      details: { retryAfterSeconds: decision === "capacity" ? 60 : seconds },
    });
  }
}
