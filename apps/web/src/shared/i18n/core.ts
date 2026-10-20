// Framework-free i18n core: English source strings are the keys; missing
// translations fall back to English. Dictionaries are registered per feature
// (src/features/<f>/i18n/pt.ts) and merged by the composition root.
export type Lang = "en" | "pt";
export type Dictionary = Readonly<Record<string, string>>;
export type Dictionaries = Readonly<Record<Lang, Dictionary>>;
export type Vars = Record<string, string | number>;

export const LANG_COOKIE = "lang";
export const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "pt", label: "PT" },
];
export function parseLang(value: unknown): Lang {
  return value === "pt" ? "pt" : "en";
}
export const localeOf = (lang: Lang) => (lang === "pt" ? "pt-BR" : "en-US");

/**
 * Replaces {name} placeholders and ICU-style plurals:
 * "{n, plural, one {# enemy} other {# enemies}}" picks the form with Intl.PluralRules for the
 * locale (zero/one/two/few/many/other, "=0" exact matches) and writes the number for "#".
 */
export function interpolate(template: string, vars?: Vars, locale = "en-US") {
  if (!vars) return template;
  return expandPlurals(template, vars, locale).replace(
    /\{(\w+)\}/g,
    (m, k: string) => (k in vars ? String(vars[k]) : m),
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
    const shown =
      typeof raw === "number" ? raw.toLocaleString(locale) : String(raw);
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
  return interpolate(dictionaries[lang][text] ?? text, vars, localeOf(lang));
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
