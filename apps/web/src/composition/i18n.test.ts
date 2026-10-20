import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { LANGUAGE_CODES } from "@cs2/contracts/languages";
import { beforeAll, describe, expect, it } from "vitest";
import {
  formatVar,
  parseLang,
  translate,
  type Dictionaries,
  type Dictionary,
  type Lang,
} from "@/shared/i18n/core";
import { createFormatters } from "@/shared/i18n/format";
import { BRAND } from "@/shared/brand";
import { loadDictionary } from "./locales";
import {
  ROOT,
  literalChecker,
  placeholders,
  requiredKeys,
  sources,
} from "./i18nKeys.testkit";

const LOCALES = LANGUAGE_CODES.filter((l) => l !== "en");
const dictionaries: Partial<Record<Lang, Dictionary>> = { en: {} };
const conflicts: Partial<Record<Lang, unknown[]>> = {};
beforeAll(async () => {
  for (const lang of LOCALES) {
    dictionaries[lang] = await loadDictionary(lang);
    conflicts[lang] = (
      (await import(`./locales/${lang}.ts`)) as { conflicts: unknown[] }
    ).conflicts;
  }
});
const all = () => dictionaries as Dictionaries;

describe("i18n", () => {
  it("defaults to English and falls back to the source text", () => {
    expect(parseLang(undefined)).toBe("en");
    expect(parseLang("xx")).toBe("en");
    expect(parseLang("fr")).toBe("fr");
    expect(translate(all(), "en", "Upload demo")).toBe("Upload demo");
    expect(translate(all(), "pt", "Untranslated sentence")).toBe(
      "Untranslated sentence",
    );
  });
  it("translates every language and writes numbers in its style", () => {
    for (const lang of LOCALES)
      expect(translate(all(), lang, "Upload demo"), lang).not.toBe(
        "Upload demo",
      );
    expect(translate(all(), "en", "{n} rounds analyzed", { n: 10 })).toBe(
      "10 rounds analyzed",
    );
    expect(formatVar(1.25, "pt-BR")).toBe("1,25");
    expect(formatVar(2026, "de")).toBe("2026");
    expect(formatVar(12345, "en-US")).toBe("12,345");
    const de = createFormatters("de");
    expect(de.number(1234.5, 1)).toBe("1.234,5");
    expect(de.percent(42)).toMatch(/^42\s?%$/);
    expect(createFormatters("en-US").currency(999, "USD")).toBe("$9.99");
    expect(createFormatters("zh-CN").date("2026-10-19T12:00:00Z")).toMatch(
      /2026/,
    );
  });
  it("chooses plural forms per language", () => {
    const d: Dictionaries = {
      ru: {
        "{n, plural, one {# death} other {# deaths}}":
          "{n, plural, one {# смерть} few {# смерти} many {# смертей} other {# смерти}}",
      },
    };
    const key = "{n, plural, one {# death} other {# deaths}}";
    expect(translate(d, "ru", key, { n: 1 })).toBe("1 смерть");
    expect(translate(d, "ru", key, { n: 3 })).toBe("3 смерти");
    expect(translate(d, "ru", key, { n: 5 })).toBe("5 смертей");
    expect(translate(d, "en", key, { n: 1 })).toBe("1 death");
  });
});

describe("translation coverage (every key in every language)", () => {
  const required = requiredKeys();
  it("has an entry for every key the UI uses", () => {
    for (const lang of LOCALES) {
      const dict = dictionaries[lang]!;
      const missing = [...required]
        .filter(([key]) => !(key in dict))
        .map(([key, from]) => `${from}: ${key}`);
      expect(missing, `${lang}: ${missing.length} missing`).toEqual([]);
    }
  });
  it("has no stale keys and the same keys in every language", () => {
    const known = literalChecker();
    const pt = Object.keys(dictionaries.pt!).sort();
    const stale = pt.filter((k) => !required.has(k) && !known(k));
    expect(stale).toEqual([]);
    for (const lang of LOCALES)
      expect(Object.keys(dictionaries[lang]!).sort(), lang).toEqual(pt);
  });
  it("keeps every placeholder and merges parts without conflicts", () => {
    for (const lang of LOCALES) {
      expect(conflicts[lang], lang).toEqual([]);
      for (const [en, text] of Object.entries(dictionaries[lang]!))
        expect(placeholders(text), `${lang}: ${en}`).toBe(placeholders(en));
    }
  });
  it("translates most keys (identical values are CS terms, numbers or names)", () => {
    for (const lang of LOCALES) {
      const entries = Object.entries(dictionaries[lang]!);
      const same = entries.filter(([en, v]) => en === v).length;
      expect(same / entries.length, lang).toBeLessThan(0.12);
    }
  });
  it("translates the brand tagline", () => {
    for (const lang of LOCALES)
      expect(dictionaries[lang]![BRAND.tagline], lang).toBeTruthy();
  });
  it("registers every feature dictionary in every language bundle", () => {
    const features = readdirSync(join(ROOT, "src/features"));
    for (const lang of LOCALES) {
      const bundle = readFileSync(
        join(ROOT, `src/composition/locales/${lang}.ts`),
        "utf8",
      );
      for (const f of features)
        expect(
          bundle,
          `${lang}: ${f} (run scripts/i18n-registry.mjs)`,
        ).toContain(`@/features/${f}/i18n/${lang}"`);
    }
  });
});

describe("copy style", () => {
  const EM_DASH = "—";
  it("has no em dash in English source strings", () => {
    const found = sources.flatMap(([file, text]) =>
      text
        .split("\n")
        .flatMap((line, i) =>
          line.includes(EM_DASH) ? [`${file}:${i + 1}: ${line.trim()}`] : [],
        ),
    );
    expect(found).toEqual([]);
  });
  it("has no em dash in any translation", () => {
    for (const lang of LOCALES) {
      const found = Object.entries(dictionaries[lang]!)
        .filter(([en, text]) => `${en}${text}`.includes(EM_DASH))
        .map(([en]) => en);
      expect(found, lang).toEqual([]);
    }
  });
});
