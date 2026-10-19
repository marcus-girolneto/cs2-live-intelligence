export type RateDecision = "allowed" | "limited" | "capacity";

/**
 * Fixed-window counter per key with a bounded number of tracked keys. A window restarts once
 * `windowMs` elapsed since it opened; `prune()` drops expired windows to free capacity.
 */
export class FixedWindowRateLimiter {
  private readonly windows = new Map<
    string,
    { start: number; count: number }
  >();
  constructor(
    private readonly options: {
      limit: number;
      windowMs: number;
      capacity: number;
      now: () => number;
    },
  ) {}

  get size(): number {
    return this.windows.size;
  }

  prune(): void {
    const now = this.options.now();
    for (const [key, window] of this.windows)
      if (now - window.start >= this.options.windowMs) this.windows.delete(key);
  }

  hit(key: string): RateDecision {
    const now = this.options.now();
    let window = this.windows.get(key);
    if (!window && this.windows.size >= this.options.capacity)
      return "capacity";
    if (!window || now - window.start >= this.options.windowMs) {
      window = { start: now, count: 0 };
      this.windows.set(key, window);
    }
    window.count++;
    return window.count > this.options.limit ? "limited" : "allowed";
  }
}
