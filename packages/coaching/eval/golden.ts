/**
 * The golden set: the public fixture match (parsed with DEMO_PARSER_BIN when available, with
 * its replay; otherwise the small enriched contract fixture) plus an optional real match read
 * at runtime from EVAL_EXTRA_ANALYSIS (a normalized demo or analysis JSON; never committed).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { analyzeDemo } from "@cs2/analytics";
import { analysisSchema, type Analysis } from "@cs2/contracts";
import type { DeepReplay, EvalCase } from "../src/index.js";

const root = new URL("../../../", import.meta.url);

function fromFile(path: string): Analysis {
  const doc = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  // A normalized demo has "events" + "rounds"; an analysis has "evidence".
  return Array.isArray(doc.evidence)
    ? analysisSchema.parse(doc)
    : analyzeDemo(doc);
}

/** The public fixture demo, parsed now (with replay samples). */
function publicFixture(env: NodeJS.ProcessEnv): EvalCase {
  const bin = env.DEMO_PARSER_BIN;
  const demo =
    env.DEMO_FIXTURE ??
    new URL("apps/demo-parser/testdata/public-cs2.dem", root).pathname;
  if (bin && existsSync(bin) && existsSync(demo)) {
    const dir = mkdtempSync(join(tmpdir(), "cs2-eval-"));
    try {
      execFileSync(
        bin,
        [
          "-input",
          demo,
          "-output",
          join(dir, "n.json"),
          "-replay",
          join(dir, "r.json.gz"),
        ],
        { stdio: "ignore", timeout: 300_000 },
      );
      const replay = existsSync(join(dir, "r.json.gz"))
        ? (JSON.parse(
            gunzipSync(readFileSync(join(dir, "r.json.gz"))).toString(),
          ) as DeepReplay)
        : undefined;
      return {
        name: "public-fixture",
        analysis: fromFile(join(dir, "n.json")),
        ...(replay ? { replay } : {}),
      };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  return {
    name: "contract-fixture",
    analysis: fromFile(
      new URL("packages/contracts/fixtures/normalized-demo-enriched.json", root)
        .pathname,
    ),
    steamId: "a",
  };
}

export function goldenCases(env: NodeJS.ProcessEnv = process.env): EvalCase[] {
  const cases = [publicFixture(env)];
  const extra = env.EVAL_EXTRA_ANALYSIS;
  if (extra && existsSync(extra))
    cases.push({
      name: "extra-real-match",
      analysis: fromFile(extra),
      ...(env.EVAL_EXTRA_STEAM_ID ? { steamId: env.EVAL_EXTRA_STEAM_ID } : {}),
    });
  return cases;
}
