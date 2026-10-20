/**
 * Players do not think in degrees. The model never receives angle numbers, and any sentence
 * that still mentions an angle ("5.5°", "3 degrees", "4 graus", "2 градуса", "5度") is removed
 * from human-readable text; when it is the only sentence, just the angle is cut out.
 */
const ANGLE =
  /\(?\s*[<>≈~]?\s*\d+(?:[.,]\d+)?\s*(?:°|º|degrees?\b|deg\b|graus?\b|grados?\b|градус\p{L}*|度|grad\b|grade?s?\b|degrés?\b|stopni\p{L}*|stopień|derece\b)\s*\)?/giu;
const MENTIONS = new RegExp(ANGLE.source, "iu");

export const mentionsDegrees = (text: string) => MENTIONS.test(text);

export function stripDegrees(text: string): string {
  if (!mentionsDegrees(text)) return text;
  // Sentence ends: ". " (not "3.2") and the CJK full stops.
  const sentences = text.split(/(?<=[.!?])\s+|(?<=[。！？])/u);
  const kept = sentences.filter((s) => s.trim() && !mentionsDegrees(s));
  if (kept.length)
    return kept.join(/[。！？]$/u.test(kept[0]!) ? "" : " ").trim();
  return text
    .replace(ANGLE, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}
