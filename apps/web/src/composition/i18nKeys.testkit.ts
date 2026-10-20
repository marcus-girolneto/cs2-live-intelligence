// Test support: every translatable English key the sources use, and every string literal
// (to tell stale dictionary keys apart). Read by i18n.test.ts only.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const ROOT = join(__dirname, "../..");
export const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? walk(join(dir, e.name))
      : /\.tsx?$/.test(e.name) && !/\.test(kit)?\./.test(e.name)
        ? [join(dir, e.name)]
        : [],
  );
const isDictionary = (f: string) =>
  /\/i18n\/(?:[a-z]{2}(?:-[\w-]+)?\.ts|[a-z]{2}\/)/.test(f) ||
  f.includes("/composition/locales/");
/** Every UI source file (routes and src/), dictionaries excluded. */
export const sources = [...walk(join(ROOT, "app")), ...walk(join(ROOT, "src"))]
  .filter((f) => !isDictionary(f))
  .map((f) => [f.slice(ROOT.length + 1), readFileSync(f, "utf8")] as const);
const PKGS = join(ROOT, "../../packages");
const packageSources = ["analytics/src", "coaching/src", "contracts/src"]
  .flatMap((d) => walk(join(PKGS, d)))
  .map((f) => readFileSync(f, "utf8"));

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
  /^src\/features\/billing\/components\/credits\//,
  /^src\/features\/billing\/model\/welcome/,
  /^src\/features\/coach\/components\/deep\//,
  /^src\/features\/coach\/model\/compare/,
  /^src\/features\/admin\/model\/credits/,
];
/** Files whose LABELS / LIMIT_LABEL records and `return "Text";` values are translated. */
const LABEL_RECORDS = [
  "src/features/coach/components/ScoreRadar.tsx",
  "src/features/admin/components/PlansEditor.tsx",
  "src/features/billing/model/plans.ts",
  "src/features/billing/model/catalogue.ts",
  "src/features/billing/model/normalize.ts",
  "src/features/billing/model/credits.ts",
  "src/features/coach/components/deep/nades.tsx",
];
/** Files whose Record<…, string> message tables are translated. */
const MESSAGE_TABLES = [
  "src/shared/http/aiError.ts",
  "src/features/coach/model/deepText.ts",
];
const read = (file: string) => readFileSync(join(ROOT, file), "utf8");

/** Required key → where it comes from (first source). */
export function requiredKeys(): Map<string, string> {
  const keys = new Map<string, string>();
  const add = (key: string, from: string) => {
    if (!keys.has(key)) keys.set(key, from);
  };
  for (const [file, text] of sources) {
    for (const m of text.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g))
      add(m[1]!, file);
    if (DYNAMIC_LABELS.some((re) => re.test(file))) {
      for (const m of text.matchAll(
        /(?:label|text|title|cta|quote|fix|q|a):\s*"((?:[^"\\]|\\.)+)"/g,
      ))
        add(m[1]!, file);
      for (const m of text.matchAll(/\[\s*"\/[a-z]*",\s*"([^"]+)"\s*\]/g))
        add(m[1]!, file);
    }
  }
  for (const file of LABEL_RECORDS) {
    const text = read(file);
    const block =
      text.match(/(?:LABELS|LIMIT_LABEL)[^=]*=\s*\{([\s\S]*?)\};/)?.[1] ?? "";
    for (const m of block.matchAll(/:\s*"([^"]+)"/g)) add(m[1]!, file);
    for (const m of text.matchAll(/return "([A-Z][^"]+)";/g)) add(m[1]!, file);
  }
  for (const literal of ["Plans saved.", "Checkout is unavailable."])
    add(literal, "billing");
  for (const file of MESSAGE_TABLES)
    for (const m of read(file).matchAll(
      /^\s+(?:\w+|"[^"]+"):\s*"([^"]+)",?$/gm,
    ))
      add(m[1]!, file);
  // Fixed caveats of the analytics and coaching packages (rendered with t()).
  for (const text of packageSources)
    for (const m of text.matchAll(/caveats\.push\(\s*"((?:[^"\\]|\\.)+)"/g))
      add(m[1]!, "packages caveats");
  // Coach options and learned patterns.
  const options = read("src/features/settings/model/coachOptions.ts");
  for (const m of options.matchAll(
    /\[\s*"[a-z]+",\s*"([^"]+)"(?:,\s*"([^"]+)")?\s*,?\s*\]/g,
  ))
    for (const label of [m[1], m[2]]) if (label) add(label, "coachOptions");
  const learn = readFileSync(join(PKGS, "coaching/src/learn.ts"), "utf8");
  for (const m of learn.matchAll(
    /(?:pattern:|tendencies\.push\()\s*"([^"]+)"/g,
  ))
    add(m[1]!, "learn.ts");
  for (const side of ["CT", "T"])
    add(`clearly stronger on ${side} side`, "learn.ts");
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
    add(focus, "learn.ts focus");
  return keys;
}

/** True when `key` appears as a string literal in the web or package sources. */
export function literalChecker(): (key: string) => boolean {
  const all = [...sources.map(([, t]) => t), ...packageSources].join("\n");
  return (key) =>
    all.includes(JSON.stringify(key)) ||
    all.includes(`\`${key}\``) ||
    all.includes(`'${key}'`);
}

/** {name} and plural heads {name, plural, …}; plural option bodies are not variables. */
export const placeholders = (s: unknown) =>
  [
    ...new Set(
      [
        ...String(s).matchAll(
          /(?<!(?:zero|one|two|few|many|other|=\d+)\s*)\{(\w+)(?=\}|,)/g,
        ),
      ].map((m) => m[1]),
    ),
  ]
    .sort()
    .join();
