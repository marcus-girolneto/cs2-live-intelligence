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

export function interpolate(template: string, vars?: Vars) {
  return vars
    ? template.replace(/\{(\w+)\}/g, (m, k: string) =>
        k in vars ? String(vars[k]) : m,
      )
    : template;
}
export function translate(
  dictionaries: Dictionaries,
  lang: Lang,
  text: string,
  vars?: Vars,
) {
  return interpolate(dictionaries[lang][text] ?? text, vars);
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
