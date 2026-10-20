/** Admin app settings beyond the AI limits: time zone, Personal Coach cadence, upload size. */
export type ProductSettings = {
  timezone: string;
  personalCoachIntervalDays: string;
  personalCoachNewMatches: string;
  /** Edited in MB; sent in bytes. */
  maxDemoMb: string;
  /** Second AI pass that checks every claim of a review against the facts. */
  verifierEnabled: boolean;
};
export const DEFAULT_TIMEZONE = "America/Sao_Paulo";
const MB = 1024 * 1024;

const COMMON_ZONES = [
  "America/Sao_Paulo",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "America/Argentina/Buenos_Aires",
  "Europe/Lisbon",
  "Europe/London",
  "Europe/Berlin",
  "UTC",
];
/** Every IANA zone the browser knows (the common ones when it can't list them). */
export function timeZones(): string[] {
  try {
    const list = (
      Intl as { supportedValuesOf?: (k: string) => string[] }
    ).supportedValuesOf?.("timeZone");
    if (list?.length) return list.includes("UTC") ? list : [...list, "UTC"];
  } catch {
    /* older engines */
  }
  return COMMON_ZONES;
}

const int = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? String(Math.round(v)) : "";

export function productSettingsOf(
  s: Record<string, unknown> | undefined,
): ProductSettings {
  const bytes = s?.maxDemoBytes;
  return {
    timezone:
      typeof s?.timezone === "string" && s.timezone
        ? s.timezone
        : DEFAULT_TIMEZONE,
    personalCoachIntervalDays: int(s?.personalCoachIntervalDays),
    personalCoachNewMatches: int(s?.personalCoachNewMatches),
    maxDemoMb:
      typeof bytes === "number" && Number.isFinite(bytes)
        ? String(Math.round(bytes / MB))
        : "",
    verifierEnabled: s?.verifierEnabled === true,
  };
}

/** Problems shown under the fields (the API enforces the same ranges). */
export function productProblems(
  p: ProductSettings,
): Partial<Record<keyof ProductSettings, string>> {
  const out: Partial<Record<keyof ProductSettings, string>> = {};
  const range = (v: string, lo: number, hi: number) =>
    v.trim() !== "" &&
    (!Number.isInteger(Number(v)) || Number(v) < lo || Number(v) > hi);
  if (range(p.personalCoachIntervalDays, 1, 90))
    out.personalCoachIntervalDays = "Between 1 and 90 days.";
  if (range(p.personalCoachNewMatches, 1, 50))
    out.personalCoachNewMatches = "Between 1 and 50 matches.";
  if (range(p.maxDemoMb, 1, 1024)) out.maxDemoMb = "Between 1 and 1024 MB.";
  return out;
}

/**
 * The PUT body: only keys the server already reports (its schema is strict), so a field the
 * backend doesn't know yet is never sent.
 */
export function productBody(
  p: ProductSettings,
  known: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const has = (k: string) => !!known && k in known;
  const body: Record<string, unknown> = {};
  if (has("timezone")) body.timezone = p.timezone;
  if (has("personalCoachIntervalDays") && p.personalCoachIntervalDays.trim())
    body.personalCoachIntervalDays = Number(p.personalCoachIntervalDays);
  if (has("personalCoachNewMatches") && p.personalCoachNewMatches.trim())
    body.personalCoachNewMatches = Number(p.personalCoachNewMatches);
  if (has("maxDemoBytes") && p.maxDemoMb.trim())
    body.maxDemoBytes = Number(p.maxDemoMb) * MB;
  if (has("verifierEnabled")) body.verifierEnabled = p.verifierEnabled;
  return body;
}
