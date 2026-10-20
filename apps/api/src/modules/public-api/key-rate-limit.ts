/** Requests per minute per API key, by the account's plan (admins: the Pro limit). */
export const PLAN_RATE_LIMITS: Record<string, number> = {
  free: 60,
  basic: 120,
  pro: 300,
  admin: 300,
};
export const DEFAULT_RATE_LIMIT = 60;
export const RATE_WINDOW_MS = 60_000;

export type RateDecisionInfo = {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the window restarts. */
  resetSeconds: number;
};

/**
 * Fixed one-minute window per API key whose limit depends on the plan. Bounded: when `capacity`
 * keys are tracked, expired windows are pruned; if still full, requests are refused (fail
 * closed) until a window expires.
 */
export class KeyRateLimiter {
  private readonly windows = new Map<
    string,
    { start: number; count: number }
  >();
  constructor(
    private readonly now: () => number = Date.now,
    private readonly capacity = 50_000,
    private readonly windowMs = RATE_WINDOW_MS,
  ) {}

  static limitFor(planId: string): number {
    return PLAN_RATE_LIMITS[planId] ?? DEFAULT_RATE_LIMIT;
  }

  hit(key: string, limit: number): RateDecisionInfo {
    const now = this.now();
    let window = this.windows.get(key);
    if (!window && this.windows.size >= this.capacity) this.prune(now);
    if (!window && this.windows.size >= this.capacity)
      return { allowed: false, limit, remaining: 0, resetSeconds: 60 };
    if (!window || now - window.start >= this.windowMs) {
      window = { start: now, count: 0 };
      this.windows.set(key, window);
    }
    window.count++;
    const resetSeconds = Math.max(
      1,
      Math.ceil((window.start + this.windowMs - now) / 1000),
    );
    return {
      allowed: window.count <= limit,
      limit,
      remaining: Math.max(0, limit - window.count),
      resetSeconds,
    };
  }

  private prune(now: number): void {
    for (const [key, window] of this.windows)
      if (now - window.start >= this.windowMs) this.windows.delete(key);
  }
}

/** Port: the plan id of an account (cached briefly by the caller). */
export interface PlanIdLookup {
  planId(ownerId: string): Promise<string>;
}

/** Caches plan ids for `ttlMs` so rate limiting costs no query on most requests. */
export class CachedPlanIds implements PlanIdLookup {
  private readonly cache = new Map<string, { id: string; at: number }>();
  constructor(
    private readonly source: (ownerId: string) => Promise<string>,
    private readonly ttlMs = 60_000,
    private readonly now: () => number = Date.now,
  ) {}
  async planId(ownerId: string): Promise<string> {
    const hit = this.cache.get(ownerId);
    if (hit && this.now() - hit.at < this.ttlMs) return hit.id;
    const id = await this.source(ownerId);
    if (this.cache.size > 10_000) this.cache.clear();
    this.cache.set(ownerId, { id, at: this.now() });
    return id;
  }
}
