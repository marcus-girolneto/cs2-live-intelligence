/**
 * Shortens text to at most `max` characters without cutting a word: ends at the last full
 * sentence when one fits in the second half, otherwise at the last space (punctuation trimmed,
 * "…" appended). Short text is returned unchanged.
 */
export function clipText(text: string, max: number): string {
  const chars = Array.from(text.trim());
  if (chars.length <= max) return chars.join("");
  const head = chars.slice(0, max - 1).join("");
  const sentence = Math.max(
    head.lastIndexOf(". "),
    head.lastIndexOf("! "),
    head.lastIndexOf("? "),
    head.lastIndexOf("。"),
  );
  if (sentence >= max / 2) return head.slice(0, sentence + 1);
  const space = head.lastIndexOf(" ");
  const cut = space >= max / 2 ? head.slice(0, space) : head;
  return cut.replace(/[\s,;:.\-–]+$/u, "") + "…";
}
