/**
 * Languages the product speaks (UI, AI output, account preference). Codes are short and
 * stable because they are stored with reviews and plans: `pt` is Brazilian Portuguese and
 * `zh` is Simplified Chinese. `tag` is the BCP 47 tag for `<html lang>` and `Intl`.
 */
export const LANGUAGES = [
  { code: "en", tag: "en", native: "English", english: "English" },
  { code: "pt", tag: "pt-BR", native: "Português (Brasil)", english: "Brazilian Portuguese" },
  { code: "es", tag: "es", native: "Español", english: "Spanish" },
  { code: "ru", tag: "ru", native: "Русский", english: "Russian" },
  { code: "zh", tag: "zh-CN", native: "简体中文", english: "Simplified Chinese" },
  { code: "de", tag: "de", native: "Deutsch", english: "German" },
  { code: "fr", tag: "fr", native: "Français", english: "French" },
  { code: "pl", tag: "pl", native: "Polski", english: "Polish" },
  { code: "tr", tag: "tr", native: "Türkçe", english: "Turkish" },
] as const;
export type LanguageCode = (typeof LANGUAGES)[number]["code"];
export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code) as [
  LanguageCode,
  ...LanguageCode[],
];
export const DEFAULT_LANGUAGE: LanguageCode = "en";

export function isLanguageCode(value: unknown): value is LanguageCode {
  return (
    typeof value === "string" &&
    (LANGUAGE_CODES as readonly string[]).includes(value)
  );
}
/** Unknown or missing values fall back to English. */
export function parseLanguage(value: unknown): LanguageCode {
  return isLanguageCode(value) ? value : DEFAULT_LANGUAGE;
}
/**
 * Maps a BCP 47 tag ("pt-PT", "zh-Hant-TW", "de-AT") to a supported language, or null.
 * Any Portuguese maps to `pt` and any Chinese to `zh` (the only variants offered).
 */
export function matchLanguage(tag: unknown): LanguageCode | null {
  if (typeof tag !== "string") return null;
  const primary = tag.trim().toLowerCase().split(/[-_]/)[0] ?? "";
  return isLanguageCode(primary) ? primary : null;
}
/** First supported language in a preference list (navigator.languages, Accept-Language). */
export function detectLanguage(tags: readonly unknown[]): LanguageCode {
  for (const tag of tags) {
    const lang = matchLanguage(tag);
    if (lang) return lang;
  }
  return DEFAULT_LANGUAGE;
}
/** Parses an Accept-Language header into tags ordered by q-value. */
export function acceptLanguageTags(header: string | null | undefined): string[] {
  if (!header) return [];
  return header
    .split(",")
    .slice(0, 20)
    .map((part, i) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = params
        .map((p) => /^\s*q=([0-9.]+)\s*$/.exec(p)?.[1])
        .find(Boolean);
      return { tag: tag.trim(), q: q === undefined ? 1 : Number(q), i };
    })
    .filter((x) => x.tag && x.tag !== "*" && Number.isFinite(x.q) && x.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i)
    .map((x) => x.tag);
}
