// Framework-free i18n core: English source strings are the keys; missing
// translations fall back to English. Each feature keeps one dictionary per
// language (src/features/<f>/i18n/<lang>.ts); the composition root bundles them
// per language (src/composition/locales/<lang>.ts) and loads only the active one.
import {
  LANGUAGES,
  detectLanguage,
  isLanguageCode,
  parseLanguage,
  type LanguageCode,
} from "@cs2/contracts/languages";

export type Lang = LanguageCode;
export type Dictionary = Readonly<Record<string, string>>;
/** Loaded dictionaries by language (English needs none: keys are the English text). */
export type Dictionaries = Readonly<Partial<Record<Lang, Dictionary>>>;
export type Vars = Record<string, string | number>;

export const LANG_COOKIE = "lang";
/** localStorage key of an explicit choice made in the language selector. */
export const LANG_STORAGE = "fragmind.lang";
export const LANGS: { code: Lang; label: string; tag: string }[] =
  LANGUAGES.map((l) => ({ code: l.code, label: l.native, tag: l.tag }));
export const parseLang = (value: unknown): Lang => parseLanguage(value);
export const isLang = (value: unknown): value is Lang => isLanguageCode(value);
/** First supported language of a browser preference list, English otherwise. */
export const detectLang = (tags: readonly unknown[]): Lang =>
  detectLanguage(tags);
/** BCP 47 tag for <html lang> ("pt-BR", "zh-CN"). */
export const htmlLang = (lang: Lang): string =>
  LANGUAGES.find((l) => l.code === lang)?.tag ?? "en";
/** Locale for Intl formatting (English formats as en-US). */
export const localeOf = (lang: Lang): string =>
  lang === "en" ? "en-US" : htmlLang(lang);

/**
 * Replaces {name} placeholders and ICU-style plurals:
 * "{n, plural, one {# enemy} other {# enemies}}" picks the form with Intl.PluralRules for the
 * locale (zero/one/two/few/many/other, "=0" exact matches) and writes the number for "#".
 */
/**
 * Numbers are written in the locale's style (decimal comma, grouping from 5 digits so years
 * and round numbers stay plain); strings are inserted as they are.
 */
export function formatVar(value: string | number, locale: string): string {
  if (typeof value !== "number" || !Number.isFinite(value))
    return String(value);
  return value.toLocaleString(locale, {
    maximumFractionDigits: 2,
    useGrouping: "min2",
  } as Intl.NumberFormatOptions);
}
export function interpolate(template: string, vars?: Vars, locale = "en-US") {
  if (!vars) return template;
  return expandPlurals(template, vars, locale).replace(
    /\{(\w+)\}/g,
    (m, k: string) => (k in vars ? formatVar(vars[k]!, locale) : m),
  );
}
function expandPlurals(template: string, vars: Vars, locale: string): string {
  const head = /\{(\w+),\s*plural,\s*/g;
  let out = "";
  let at = 0;
  for (let m = head.exec(template); m; m = head.exec(template)) {
    const forms: Record<string, string> = {};
    let i = m.index + m[0].length;
    // Options: selector {text} pairs until the closing brace of the plural.
    while (i < template.length && template[i] !== "}") {
      const sel = /^\s*(=\d+|zero|one|two|few|many|other)\s*\{/.exec(
        template.slice(i),
      );
      if (!sel) break;
      i += sel[0].length;
      let depth = 1;
      const start = i;
      while (i < template.length && depth > 0) {
        if (template[i] === "{") depth++;
        else if (template[i] === "}") depth--;
        i++;
      }
      forms[sel[1]!] = template.slice(start, i - 1);
      while (template[i] === " ") i++;
    }
    const raw = vars[m[1]!];
    const n = typeof raw === "number" ? raw : Number(raw);
    const form =
      forms[`=${n}`] ??
      forms[new Intl.PluralRules(locale).select(n)] ??
      forms.other ??
      "";
    const shown = formatVar(raw!, locale);
    out += template.slice(at, m.index) + form.replace(/#/g, shown);
    at = i + 1;
    head.lastIndex = at;
  }
  return out + template.slice(at);
}
export function translate(
  dictionaries: Dictionaries,
  lang: Lang,
  text: string,
  vars?: Vars,
) {
  return interpolate(dictionaries[lang]?.[text] ?? text, vars, localeOf(lang));
}

/** Merges feature dictionaries; a key defined twice must carry the same text. */
export function mergeDictionaries(parts: Record<string, Dictionary>): {
  merged: Record<string, string>;
  conflicts: string[];
} {
  const merged: Record<string, string> = {};
  const conflicts: string[] = [];
  for (const [owner, dict] of Object.entries(parts))
    for (const [key, value] of Object.entries(dict)) {
      if (key in merged && merged[key] !== value)
        conflicts.push(`${owner}: ${key}`);
      merged[key] = value;
    }
  return { merged, conflicts };
}
