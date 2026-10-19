import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseLang, translate } from "@/shared/i18n/core";
import { dictionaries, ptConflicts } from "./i18n";

const pt = dictionaries.pt;
const ROOT = join(__dirname, "../..");
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? walk(join(dir, e.name))
      : /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name)
        ? [join(dir, e.name)]
        : [],
  );
/** Every UI source file (routes and src/), dictionaries excluded. */
const sources = [...walk(join(ROOT, "app")), ...walk(join(ROOT, "src"))]
  .filter((f) => !/\/i18n\/pt/.test(f))
  .map((f) => [f.slice(ROOT.length + 1), readFileSync(f, "utf8")] as const);

/** Files that keep user-facing labels in arrays/records and translate them via t(label). */
const DYNAMIC_LABELS = [
  /^src\/features\/analysis\/(components|model\/metrics)/,
  /^src\/features\/live\/(components\/Hud|model\/liveCoach)/,
  /^src\/features\/shell\//,
  /^src\/features\/landing\//,
  /^src\/features\/auth\/components\/SteamIdentity/,
  /^src\/features\/dashboard\//,
  /^src\/features\/maps\/model\/progress/,
  /^src\/features\/billing\/components\/PlanComparison/,
];
/** Files whose LABELS / LIMIT_LABEL records and `return "Text";` values are translated. */
const LABEL_RECORDS = [
  "src/features/coach/components/ScoreRadar.tsx",
  "src/features/admin/components/PlansEditor.tsx",
  "src/features/billing/model/plans.ts",
  "src/features/billing/model/catalogue.ts",
  "src/features/billing/model/normalize.ts",
];

describe("i18n", () => {
  it("defaults to English and falls back to the source text", () => {
    expect(parseLang(undefined)).toBe("en");
    expect(parseLang("fr")).toBe("en");
    expect(translate(dictionaries, "en", "Upload demo")).toBe("Upload demo");
    expect(translate(dictionaries, "pt", "Untranslated sentence")).toBe(
      "Untranslated sentence",
    );
  });
  it("translates to Portuguese and keeps placeholders", () => {
    expect(translate(dictionaries, "pt", "Upload demo")).toBe(
      pt["Upload demo"],
    );
    expect(
      translate(dictionaries, "en", "{n} rounds analyzed", { n: 10 }),
    ).toBe("10 rounds analyzed");
    expect(
      translate(dictionaries, "pt", "{n} rounds analyzed", { n: 10 }),
    ).toContain("10");
  });
  it("keeps every placeholder in translations", () => {
    for (const [en, ptText] of Object.entries(pt)) {
      const vars = (s: unknown) =>
        (String(s).match(/\{\w+\}/g) ?? []).sort().join();
      expect(vars(ptText), en).toBe(vars(en));
    }
  });
  it("merges feature dictionaries without conflicting translations", () => {
    expect(ptConflicts).toEqual([]);
  });
});

describe("translation coverage", () => {
  it("has a Portuguese entry for every literal t() key", () => {
    const missing = sources.flatMap(([file, text]) =>
      [...text.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)]
        .map((m) => m[1]!)
        .filter((key) => !(key in pt))
        .map((key) => `${file}: ${key}`),
    );
    expect(missing).toEqual([]);
  });
  it("translates labels kept in arrays and records (translated via t(label))", () => {
    const missing: string[] = [];
    for (const [file, text] of sources) {
      if (!DYNAMIC_LABELS.some((re) => re.test(file))) continue;
      for (const m of text.matchAll(
        /(?:label|text|title|cta|quote|fix|q|a):\s*"((?:[^"\\]|\\.)+)"/g,
      ))
        if (!(m[1]! in pt)) missing.push(`${file}: ${m[1]}`);
      for (const m of text.matchAll(/\[\s*"\/[a-z]*",\s*"([^"]+)"\s*\]/g))
        if (!(m[1]! in pt)) missing.push(`${file}: ${m[1]}`);
    }
    expect(missing).toEqual([]);
  });
  it("translates score, limit and plan labels kept in records", () => {
    const missing: string[] = [];
    for (const file of LABEL_RECORDS) {
      const text = readFileSync(join(ROOT, file), "utf8");
      const block =
        text.match(/(?:LABELS|LIMIT_LABEL)[^=]*=\s*\{([\s\S]*?)\};/)?.[1] ?? "";
      for (const m of block.matchAll(/:\s*"([^"]+)"/g))
        if (!(m[1]! in pt)) missing.push(`${file}: ${m[1]}`);
      for (const m of text.matchAll(/return "([A-Z][^"]+)";/g))
        if (!(m[1]! in pt)) missing.push(`${file}: ${m[1]}`);
    }
    for (const literal of ["Plans saved.", "Checkout is unavailable."])
      if (!(literal in pt)) missing.push(literal);
    expect(missing).toEqual([]);
  });
});

describe("coach labels and learned patterns", () => {
  it("are all translated", () => {
    const missing: string[] = [];
    const options = readFileSync(
      join(ROOT, "src/features/settings/model/coachOptions.ts"),
      "utf8",
    );
    for (const m of options.matchAll(
      /\[\s*"[a-z]+",\s*"([^"]+)"(?:,\s*"([^"]+)")?\s*,?\s*\]/g,
    ))
      for (const label of [m[1], m[2]])
        if (label && !(label in pt)) missing.push(label);
    const learn = readFileSync(
      join(ROOT, "../../packages/coaching/src/learn.ts"),
      "utf8",
    );
    for (const m of learn.matchAll(
      /(?:pattern:|tendencies\.push\()\s*"([^"]+)"/g,
    ))
      if (!(m[1]! in pt)) missing.push(m[1]!);
    for (const side of ["CT", "T"])
      if (!(`clearly stronger on ${side} side` in pt)) missing.push(side);
    for (const focus of [
      "trade",
      "info",
      "tempo",
      "aim",
      "economy",
      "mindset",
      "closing",
      "keep",
    ])
      if (!(focus in pt)) missing.push(focus);
    expect(missing).toEqual([]);
  });
});
