// Architecture fitness tests for the web app (see docs/ADR-005-web-architecture.md).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const MAX_LINES = 300;

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? walk(join(dir, e.name))
      : /\.(ts|tsx)$/.test(e.name)
        ? [join(dir, e.name)]
        : [],
  );
}
const sources = [...walk(join(ROOT, "app")), ...walk(join(ROOT, "src"))];
const rel = (file: string) => relative(ROOT, file);
const importsOf = (file: string) =>
  [
    ...readFileSync(file, "utf8").matchAll(
      /(?:import|export)\s[^;]*?from\s+"([^"]+)"|import\(\s*"([^"]+)"\s*\)/g,
    ),
  ].map((m) => (m[1] ?? m[2])!);
const featureOf = (file: string) =>
  rel(file).match(/^src\/features\/([^/]+)\//)?.[1] ?? null;

describe("web architecture", () => {
  it("has no legacy lib/ or components/ directories", () => {
    expect(walk(join(ROOT, "lib")).map(rel)).toEqual([]);
    expect(walk(join(ROOT, "components")).map(rel)).toEqual([]);
  });

  it(`keeps every source file under ${MAX_LINES} lines`, () => {
    const big = sources
      .map((f) => [rel(f), readFileSync(f, "utf8").split("\n").length] as const)
      .filter(([, n]) => n > MAX_LINES)
      .map(([f, n]) => `${f}: ${n}`);
    expect(big).toEqual([]);
  });

  it("keeps shared/ independent of features, composition and server", () => {
    const bad = sources
      .filter((f) => rel(f).startsWith("src/shared/"))
      .flatMap((f) =>
        importsOf(f)
          .filter((i) =>
            /^@\/(features|composition|server)\/|\/(features|composition|server)\//.test(
              i,
            ),
          )
          .map((i) => `${rel(f)} → ${i}`),
      );
    expect(bad).toEqual([]);
  });

  it("imports other features only through their public index", () => {
    const bad = sources.flatMap((f) =>
      importsOf(f)
        .filter((i) => /^@\/features\/[^/]+\/.+/.test(i))
        // Per-language bundles import each feature's dictionary directly.
        .filter(
          (i) =>
            !(
              rel(f).startsWith("src/composition/locales/") &&
              /^@\/features\/[^/]+\/i18n\/[a-z]{2}$/.test(i)
            ),
        )
        .map((i) => `${rel(f)} → ${i}`),
    );
    expect(bad).toEqual([]);
  });

  it("keeps relative imports inside the owning feature", () => {
    const bad = sources.flatMap((f) => {
      const own = featureOf(f);
      if (!own) return [];
      return importsOf(f)
        .filter((i) => i.startsWith("."))
        .filter((i) => {
          const target = rel(join(f, "..", i));
          return !target.startsWith(`src/features/${own}`);
        })
        .map((i) => `${rel(f)} → ${i}`);
    });
    expect(bad).toEqual([]);
  });

  it("has an acyclic feature dependency graph", () => {
    const graph = new Map<string, Set<string>>();
    for (const f of sources) {
      const from = featureOf(f);
      if (!from) continue;
      const deps = graph.get(from) ?? new Set<string>();
      for (const i of importsOf(f)) {
        const to = i.match(/^@\/features\/([^/]+)$/)?.[1];
        if (to && to !== from) deps.add(to);
      }
      graph.set(from, deps);
    }
    const cycles: string[] = [];
    const state = new Map<string, "visiting" | "done">();
    const visit = (node: string, path: string[]) => {
      if (state.get(node) === "done") return;
      if (state.get(node) === "visiting") {
        cycles.push([...path.slice(path.indexOf(node)), node].join(" → "));
        return;
      }
      state.set(node, "visiting");
      for (const next of graph.get(node) ?? []) visit(next, [...path, node]);
      state.set(node, "done");
    };
    for (const node of graph.keys()) visit(node, []);
    expect(cycles).toEqual([]);
  });

  it("gives every feature a public index", () => {
    const features = readdirSync(join(ROOT, "src/features"), {
      withFileTypes: true,
    })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    const missing = features.filter(
      (f) => !existsSync(join(ROOT, "src/features", f, "index.ts")),
    );
    expect(missing).toEqual([]);
  });

  it("keeps route files thin (they compose a screen or delegate to src/server)", () => {
    const fat = sources
      .filter((f) => rel(f).startsWith("app/"))
      .filter((f) => readFileSync(f, "utf8").split("\n").length > 60)
      .map(rel);
    expect(fat).toEqual([]);
  });
});
