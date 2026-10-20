/**
 * pnpm eval:ai: nightly AI evaluation.
 *
 * API mode (uses the running API's admin-assigned providers; keys never leave the server):
 *   EVAL_API_URL=http://127.0.0.1:4000 EVAL_TOKEN=<admin bearer> pnpm eval:ai [--analysis-id <id> --steam-id <id>]
 * Env mode (CI): AI_PROVIDER / AI_MODEL / AI_API_KEY (+ optional AI_BASE_URL) for every purpose.
 * Options: --langs pt,en (default pt). Reports go to artifacts/eval/ (git-ignored).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  evalMarkdown,
  loadAiConfig,
  runEval,
  type EvalReport,
  type Prices,
} from "../src/index.js";
import { goldenCases } from "./golden.js";

const args = process.argv.slice(2);
const arg = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const langs = (arg("langs") ?? "pt")
  .split(",")
  .filter((l): l is "en" | "pt" => l === "en" || l === "pt");
const outDir =
  arg("out") ?? new URL("../../../artifacts/eval/", import.meta.url).pathname;
const prices = process.env.EVAL_PRICES_JSON
  ? (JSON.parse(process.env.EVAL_PRICES_JSON) as Prices)
  : undefined;

async function viaApi(url: string, token: string): Promise<EvalReport> {
  const analysisId = arg("analysis-id");
  const cases = goldenCases().map((c) => ({
    name: c.name,
    analysis: c.analysis,
    ...(c.steamId ? { steamId: c.steamId } : {}),
  }));
  const response = await fetch(
    `${url.replace(/\/$/, "")}/v1/admin/ai/eval/run`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        langs,
        cases,
        ...(analysisId
          ? {
              analyses: [
                {
                  analysisId,
                  ...(arg("steam-id") ? { steamId: arg("steam-id") } : {}),
                },
              ],
            }
          : {}),
      }),
    },
  );
  if (!response.ok)
    throw new Error(
      `eval API answered ${response.status}: ${(await response.text()).slice(0, 300)}`,
    );
  return (await response.json()) as EvalReport;
}

async function viaEnv(): Promise<EvalReport> {
  const loaded = loadAiConfig(process.env);
  if (!loaded.ok) throw new Error(`AI is not configured: ${loaded.reason}`);
  const config = loaded.config;
  return runEval(goldenCases(), {
    configs: { review_quick: config, review_deep: config, review_team: config },
    verifier: config,
    langs,
    ...(prices ? { prices } : {}),
  });
}

const url = process.env.EVAL_API_URL;
const report = url
  ? await viaApi(url, process.env.EVAL_TOKEN ?? process.env.WEB_TOKEN ?? "")
  : await viaEnv();
mkdirSync(outDir, { recursive: true });
const stamp = report.createdAt.replace(/[:.]/g, "-");
writeFileSync(
  join(outDir, `report-${stamp}.json`),
  JSON.stringify(report, null, 2),
);
writeFileSync(join(outDir, `report-${stamp}.md`), evalMarkdown(report));
writeFileSync(join(outDir, "latest.json"), JSON.stringify(report, null, 2));
writeFileSync(join(outDir, "latest.md"), evalMarkdown(report));
console.log(evalMarkdown(report));
console.log(`Report written to ${join(outDir, `report-${stamp}.json`)}`);
