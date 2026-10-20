/**
 * Callouts as people say them. Demos store place names as CamelCase ids ("TopofMid",
 * "SnipersNest", "BombsiteA", "CTSpawn"); the model and the UI get the readable form
 * ("Top of Mid", "Sniper's Nest", "Bombsite A", "CT Spawn").
 */
const SPECIAL: Record<string, string> = {
  SnipersNest: "Sniper's Nest",
  TopofMid: "Top of Mid",
  CTSpawn: "CT Spawn",
  TSpawn: "T Spawn",
  BombsiteA: "Bombsite A",
  BombsiteB: "Bombsite B",
  BackofA: "Back of A",
  BackofB: "Back of B",
  TRamp: "T Ramp",
  CTRamp: "CT Ramp",
  CTStart: "CT Start",
  TStart: "T Start",
  BDoors: "B Doors",
  ADoors: "A Doors",
  ASite: "A Site",
  BSite: "B Site",
};
/** Words that look like CamelCase but are not callouts. */
const NOT_CALLOUTS = new Set([
  "AWPer",
  "AWPers",
  "YouTube",
  "FaceIt",
  "OpenAI",
  "DeepSeek",
  "TikTok",
  "GamersClub",
]);

/** Readable callout ("TopofMid" → "Top of Mid"); unchanged when already readable. */
export function calloutName(raw: string): string {
  const text = raw.trim();
  if (SPECIAL[text]) return SPECIAL[text]!;
  return text
    .replace(/_/g, " ")
    .replace(/([a-z])of([A-Z])/g, "$1 of $2")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

const TOKEN = /(?<![\p{L}\p{N}_'-])[A-Za-z][A-Za-z0-9]*(?![\p{L}\p{N}_'-])/gu;
/** True for a CamelCase place id such as "TopofMid", "CTSpawn" or "LongA". */
export function isRawCallout(token: string): boolean {
  if (NOT_CALLOUTS.has(token) || token.length < 5) return false;
  if (SPECIAL[token]) return true;
  // Plurals of acronyms ("IGLs", "HEs", "CTs") are not callouts.
  if (/^[A-Z]{2,}s$/.test(token)) return false;
  return (
    /^[A-Z]/.test(token) &&
    /[a-z][A-Z]|^[A-Z]{2,}[a-z]|[a-z]of[A-Z]/.test(token)
  );
}
/** Replaces raw CamelCase callouts inside a sentence (whole words only). */
export function prettifyCallouts(text: string): string {
  return text.replace(TOKEN, (w) => (isRawCallout(w) ? calloutName(w) : w));
}
