/** Pure upload-progress math: speed over a sliding window, ETA and labels. */
export type Sample = { at: number; loaded: number };

/** Window used to smooth the transfer speed. */
export const RATE_WINDOW_MS = 4000;

/** Keeps only the samples inside the window (plus the newest). */
export function pushSample(samples: Sample[], next: Sample): Sample[] {
  const kept = samples.filter((s) => next.at - s.at <= RATE_WINDOW_MS);
  return [...kept, next];
}

/** Bytes per second across the window; null until there's enough signal. */
export function uploadRate(samples: Sample[]): number | null {
  if (samples.length < 2) return null;
  const a = samples[0]!;
  const b = samples[samples.length - 1]!;
  const dt = (b.at - a.at) / 1000;
  if (dt < 0.25) return null;
  const rate = (b.loaded - a.loaded) / dt;
  return rate > 0 ? rate : null;
}

/** Seconds left at the current rate; null when unknown. */
export function etaSeconds(
  loaded: number,
  total: number,
  rate: number | null,
): number | null {
  if (!rate || total <= 0 || loaded >= total) return null;
  return Math.ceil((total - loaded) / rate);
}

export const percent = (loaded: number, total: number) =>
  total > 0 ? Math.min(100, Math.floor((loaded / total) * 100)) : 0;

/** "42.0 MB" — megabytes with one decimal. */
export const megabytes = (bytes: number) => bytes / (1024 * 1024);

/** {m, s} for an ETA label. */
export function splitDuration(seconds: number) {
  return { m: Math.floor(seconds / 60), s: seconds % 60 };
}

/**
 * Demo size limit announced by the API (GET me: `maxUploadBytes`, top-level, under
 * `limits` or under `plan.limits`), else the proxy's own cap. Never above the cap.
 */
export function uploadLimitBytes(account: unknown, cap: number): number {
  const o = (v: unknown) =>
    v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  const a = o(account);
  for (const v of [
    a.uploadMaxBytes,
    a.maxUploadBytes,
    o(a.limits).maxUploadBytes,
    o(o(a.plan).limits).maxUploadBytes,
  ])
    if (typeof v === "number" && Number.isFinite(v) && v > 0)
      return Math.min(v, cap);
  return cap;
}
