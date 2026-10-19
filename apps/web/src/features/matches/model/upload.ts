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

/**
 * A friendly message for a failed upload (EN source; translate with t()). Returns null
 * for errors that are not about the upload itself (e.g. plan limits, handled elsewhere).
 */
export function uploadErrorMessage(e: unknown): {
  text: string;
  params?: Record<string, string>;
} | null {
  const status =
    e && typeof e === "object" && "status" in e ? Number(e.status) : NaN;
  const code =
    e && typeof e === "object" && "code" in e && typeof e.code === "string"
      ? e.code
      : null;
  if (code === "not_cs2_demo")
    return {
      text: "This file isn't a CS2 demo. In CS2, download the match from Watch → Your Matches and upload the .dem file.",
    };
  if (code === "too_small")
    return {
      text: "This demo is too short to analyze. Upload a full match (at least a few rounds).",
    };
  if (code === "too_large" || status === 413)
    return { text: "This demo is larger than the upload limit." };
  if (status === 429)
    return {
      text: "You're uploading too fast. Wait a minute and try again.",
    };
  return null;
}
