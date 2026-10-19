import { chromium, expect } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);
const config = Object.fromEntries(
  (await readFile(".env", "utf8"))
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);
const headers = { Authorization: `Bearer ${config.WEB_TOKEN}` };
async function get(path: string) {
  const response = await fetch(`http://127.0.0.1:4000${path}`, { headers });
  if (!response.ok) throw new Error(`API ${path} HTTP ${response.status}`);
  return response.json();
}
await mkdir("artifacts/release", { recursive: true });
const before = await get("/v1/matches");
const match = before.matches.find(
  (m: { filename: string; status: string }) =>
    m.filename === "public-cs2.dem" && m.status === "complete",
);
if (!match) throw new Error("Run local-setup.py --with-demo first");
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    recordVideo: { dir: "artifacts/release/docker-video" },
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:3000");
  await page.getByLabel("Owner token").fill(config.WEB_TOKEN);
  await page.getByLabel("Session ID").fill("docker-session");
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.getByTestId("connection-status")).toHaveText(
    /^(Waiting for telemetry|Live|Stale)$/,
  );
  const now = new Date().toISOString();
  const response = await fetch("http://127.0.0.1:4000/v1/telemetry/gsi", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.DEVICE_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      schemaVersion: "1.0",
      eventId: `docker-${Date.now()}`,
      deviceId: config.DEVICE_ID || "dev-device",
      sessionId: "docker-session",
      sequence: Date.now(),
      observedAt: now,
      receivedAt: now,
      source: "gsi",
      visibility: "own-player",
      payload: {
        map: {
          name: "de_mirage",
          round: 7,
          phase: "live",
          team_ct: { score: 4 },
          team_t: { score: 2 },
        },
        provider: { steamid: "local-simulated-player" },
        player: {
          steamid: "local-simulated-player",
          match_stats: { kills: 8, deaths: 3 },
        },
      },
    }),
  });
  if (response.status !== 202) throw new Error("Docker ingest failed");
  await expect(page.getByTestId("kills")).toHaveText("8");
  await page.screenshot({
    path: "artifacts/release/docker-live.png",
    fullPage: true,
  });
  await page.goto("http://127.0.0.1:3000/history");
  await page
    .getByRole("button", { name: /public-cs2.dem/ })
    .first()
    .click();
  await page.getByRole("heading", { name: "Practice feedback" }).waitFor();
  await page
    .getByRole("cell", { name: "120.7", exact: true })
    .first()
    .waitFor();
  await page.screenshot({
    path: "artifacts/release/docker-analysis.png",
    fullPage: true,
  });
  await page.screenshot({
    path: "artifacts/release/docker-analysis-viewport.png",
  });
  await run("docker", [
    "compose",
    "-f",
    "compose.yaml",
    "-f",
    "compose.local.yaml",
    "restart",
    "api",
  ]);
  let recovered = false;
  for (let i = 0; i < 60; i++) {
    try {
      const after = await get(`/v1/matches/${match.id}`);
      if (after.status === "complete") {
        recovered = true;
        break;
      }
    } catch {
      /* restarting */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!recovered)
    throw new Error("Persisted analysis did not survive container restart");
  const analysis = await get(`/v1/analyses/${match.analysisId}`);
  await writeFile(
    "artifacts/release/docker-validation.json",
    JSON.stringify(
      {
        verifiedAt: new Date().toISOString(),
        target: "Docker local production bundles",
        demo: match.filename,
        map: analysis.analysis.map,
        players: analysis.analysis.players.length,
        rounds: analysis.analysis.roundOutcomes.length,
        events: analysis.analysis.events.length,
        firstPlayer: analysis.analysis.players[0],
        coachingMode: analysis.coaching.mode,
        provenance: analysis.analysis.provenance,
        containerRestartPersistence: true,
      },
      null,
      2,
    ) + "\n",
  );
  await context.close();
  console.log(
    "Docker UI, WebSocket, real demo metrics and restart persistence verified.",
  );
} finally {
  await browser.close();
}
