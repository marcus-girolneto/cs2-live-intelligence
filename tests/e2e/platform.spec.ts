import { test, expect } from "@playwright/test";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
const fixture = resolve("apps/demo-parser/testdata/public-cs2.dem");
test("pairing, real demo upload, cited analysis, consent and account deletion", async ({
  page,
  request,
}, info) => {
  test.setTimeout(180000);
  test.skip(
    !existsSync(fixture),
    "Run public fixture fetch script before real demo browser validation",
  );
  const headers = { Authorization: "Bearer e2e-browser-secret" };
  await page.goto("/settings");
  // Steam identity panel offers the real OpenID sign-in even in local mode.
  await expect(
    page.getByRole("heading", { name: "Steam account" }),
  ).toBeVisible();
  await expect(
    page.locator("#steam").getByRole("button", { name: "Sign in with Steam" }),
  ).toBeVisible();
  const start = await request.get(
    "http://127.0.0.1:3100/api/platform/auth/steam/start",
  );
  expect(new URL((await start.json()).url).origin).toBe(
    "https://steamcommunity.com",
  );
  // The AI provider configuration lives in the admin area (tests/e2e/admin.spec.ts).
  // Coach personality is saved to the account and used by every AI request.
  await page.locator("#coach").getByText("Aggressive", { exact: true }).click();
  await page.getByLabel("Your role").selectOption("entry");
  await page
    .getByLabel("Custom instructions for your coach")
    .fill("Keep calls short.");
  await page.getByRole("button", { name: "Save coach preferences" }).click();
  await expect(page.getByText("Coach preferences saved.")).toBeVisible();
  await page.getByLabel("Device name").fill("Browser integration collector");
  await page.getByRole("button", { name: "Create pairing code" }).click();
  const devices = await request.get("http://127.0.0.1:4100/v1/devices", {
    headers,
  });
  expect(devices.ok()).toBe(true);
  // Claim over the collector channel; the UI only receives the code, never a device credential.
  const pair = await request.post("http://127.0.0.1:4100/v1/devices/pair", {
    headers,
    data: { name: "E2E private collector" },
  });
  expect(pair.ok()).toBe(true);
  const code = (await pair.json()).code;
  const claimed = await request.post("http://127.0.0.1:4100/v1/devices/claim", {
    data: { code },
  });
  expect(claimed.ok()).toBe(true);
  const identity = await claimed.json();
  expect(
    (
      await request.post("http://127.0.0.1:4100/v1/devices/claim", {
        data: { code },
      })
    ).ok(),
  ).toBe(false);
  expect(await page.content()).not.toContain(identity.token);
  await page
    .getByLabel("Allow product analytics and feedback collection")
    .check();
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (
          await (
            await request.get("http://127.0.0.1:4100/v1/settings", { headers })
          ).json()
        ).analyticsConsent,
    )
    .toBe(true);
  await page.goto("/upload");
  await page.getByLabel("Demo file").setInputFiles(fixture);
  await page.getByRole("button", { name: "Upload demo", exact: true }).click();
  await expect(page).toHaveURL(/\/history/, { timeout: 120000 });
  let matchId = "";
  await expect
    .poll(
      async () => {
        const r = await request.get("http://127.0.0.1:4100/v1/matches", {
          headers,
        });
        const data = await r.json();
        const match = data.matches.find(
          (m: { filename: string }) => m.filename === "public-cs2.dem",
        );
        matchId = match?.id ?? "";
        if (match?.status === "failed") throw new Error(match.error);
        return match?.status;
      },
      { timeout: 120000, intervals: [500, 1000, 2000] },
    )
    .toBe("complete");
  // The upload redirects to its own match, which is selected and polled automatically.
  await page.getByRole("button", { name: /public-cs2.dem/ }).click();
  await expect(page.getByRole("tab", { name: "Overview" })).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByText("120.7", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("KAST", { exact: true }).first()).toBeVisible();
  const body = await page.locator("body").innerText();
  expect(body).not.toMatch(/\bNaN\b|\bundefined\b|Infinity/);
  // AI Coach: per-player review whose evidence links to concrete rounds.
  // AI Coach: every request is a real call to the configured provider (mock server in E2E).
  // A quick review is one review call plus one claim-verifier call (verifier on by default).
  const calls = async () =>
    (await (await request.get("http://127.0.0.1:3120/calls")).json()) as {
      review: number;
      verify: number;
    };
  const before = await calls();
  const reviewCalls = async () => (await calls()).review - before.review;
  const verifyCalls = async () => (await calls()).verify - before.verify;
  // The AI Coach tab of the analysis is a compact preview that opens the /coach screen.
  await page.getByRole("tab", { name: "AI Coach" }).click();
  await page.getByTestId("open-coach").click();
  await expect(page).toHaveURL(/\/coach\?match=/);
  // The dev owner has no SteamID: pick the first player of the roster.
  await expect(page.locator(".roster-card").first()).toBeVisible({
    timeout: 30000,
  });
  await page.locator(".roster-card").first().click();
  // Step 3: choose the review tier (the admin dev owner runs it without credits).
  await expect(page.getByTestId("tier-quick")).toBeVisible();
  await page.getByRole("button", { name: /Run Quick review/ }).click();
  await expect(page.getByTestId("coach-report")).toBeVisible({
    timeout: 30000,
  });
  await expect(
    page.getByText("Mock model review for end-to-end tests."),
  ).toBeVisible();
  expect(await reviewCalls()).toBe(1);
  expect(await verifyCalls()).toBe(1);
  // The AI is presented as the app's own coach: no model or provider is shown.
  const coachText = await page.locator("body").innerText();
  expect(coachText).not.toContain("e2e/mock-model");
  expect(coachText).not.toContain("e2e-mock");
  // innerText applies CSS text-transform (the eyebrow is uppercase).
  expect(coachText.toLowerCase()).toContain("fragmind coach");
  await expect(page.getByText("Mock plan: trade your entry")).toBeVisible();
  await page.getByRole("button", { name: "5 stars" }).click();
  await expect(page.getByText("Saved to your progress.")).toBeVisible();
  // "Ask again" goes back to the tier step, where the Quick review can be run again.
  await page.getByRole("button", { name: "Ask again" }).click();
  await expect(page.getByTestId("tier-quick")).toBeVisible();
  await page
    .getByTestId("tier-quick")
    .getByRole("button", { name: /Run again/ })
    .click();
  await expect(page.getByTestId("coach-report")).toBeVisible({
    timeout: 30000,
  });
  await expect.poll(reviewCalls).toBe(2);
  await expect.poll(verifyCalls).toBe(2);
  await expect(page.locator(".coach-card").first()).toBeVisible();
  expect(await page.locator("body").innerText()).not.toMatch(
    /\bNaN\b|\bundefined\b|Infinity/,
  );
  // Back to the match analysis for the remaining checks.
  await page.getByRole("link", { name: /Open match analysis/ }).click();
  await expect(page.getByRole("tab", { name: "Overview" })).toBeVisible({
    timeout: 30000,
  });
  await page.getByRole("tab", { name: "Rounds" }).click();
  await expect(page.locator(".round-card").first()).toBeVisible();
  await expect(page.locator(".killfeed li").first()).toBeVisible();
  await page.getByRole("tab", { name: "Data & sources" }).click();
  await expect(
    page.getByRole("cell", { name: /opening kills/i }).first(),
  ).toBeVisible();
  // Mark the player as "me" so the second screen can use them as a baseline.
  await page.getByRole("button", { name: "This is me" }).click();
  await expect(
    page.getByRole("button", { name: "This is me ✓" }),
  ).toBeVisible();
  await page
    .getByLabel("Feedback comment")
    .fill("Verified real demo and traceable metrics");
  await page.getByRole("button", { name: "Send feedback" }).click();
  await expect(page.getByText("Thanks! Feedback saved.")).toBeVisible();
  await page.screenshot({
    path: info.outputPath("real-demo-analysis.png"),
    fullPage: true,
  });
  // Progress: the review, its plan, the rating and the learned profile are persisted.
  await page.goto("/progress");
  // The dev owner has no SteamID: progress asks once which player to follow.
  const pickPlayer = page.getByRole("region", {
    name: "Which player are you in these demos?",
  });
  await pickPlayer.getByRole("button").first().click();
  await expect(pickPlayer).toBeHidden();
  // The archive (learned profile, reviews with ratings) sits in the collapsed History.
  await page.locator(".progress-history > summary").click();
  await expect(
    page.getByRole("heading", { name: "What the coach learned about you" }),
  ).toBeVisible();
  await expect(
    page.getByText("Mock plan: trade your entry").first(),
  ).toBeVisible();
  await expect(
    page.locator(".review-list .stars button.on").first(),
  ).toBeVisible();
  expect(await page.locator("body").innerText()).not.toMatch(
    /\bNaN\b|\bundefined\b|Infinity/,
  );
  // Second screen: replay the analyzed demo through the HUD and live coach.
  await page.goto("/live");
  await page.getByRole("tab", { name: "Replay a demo" }).click();
  await expect(page.locator(".hud-badge.replay")).toBeVisible({
    timeout: 20000,
  });
  await page.getByLabel("Speed").selectOption("4");
  await expect(page.locator(".timeline li").first()).toBeVisible({
    timeout: 20000,
  });
  await expect(page.getByText(/Your baseline/)).toBeVisible();
  await expect(page.locator(".tips li").first()).toBeVisible();
  await expect(page.getByTestId("ai-live-call")).toContainText("Mock IGL", {
    timeout: 30000,
  });
  await page.screenshot({
    path: info.outputPath("second-screen-replay.png"),
    fullPage: true,
  });
  const match = await (
    await request.get(`http://127.0.0.1:4100/v1/matches/${matchId}`, {
      headers,
    })
  ).json();
  const analysis = await (
    await request.get(`http://127.0.0.1:4100/v1/analyses/${match.analysisId}`, {
      headers,
    })
  ).json();
  expect(analysis.analysis.players).toHaveLength(10);
  expect(analysis.coaching.insights.length).toBeGreaterThan(0);
  const ids = new Set(
    analysis.analysis.evidence.map((e: { id: string }) => e.id),
  );
  for (const insight of analysis.coaching.insights)
    for (const id of insight.evidenceIds) expect(ids.has(id)).toBe(true);
  await page.goto("/settings");
  await page.getByLabel("Allow match telemetry and demo processing").uncheck();
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (
          await (
            await request.get("http://127.0.0.1:4100/v1/settings", { headers })
          ).json()
        ).telemetryConsent,
    )
    .toBe(false);
  const denied = await request.post("http://127.0.0.1:4100/v1/telemetry/gsi", {
    headers: { Authorization: "Bearer e2e-device-secret" },
    data: {
      schemaVersion: "1.0",
      eventId: "after-consent-withdrawal",
      deviceId: "dev-device",
      sessionId: "dev-session",
      sequence: 200,
      source: "gsi",
      visibility: "own-player",
      observedAt: new Date().toISOString(),
      receivedAt: new Date().toISOString(),
      payload: {},
    },
  });
  expect(denied.status()).toBe(403);
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await page
    .getByRole("button", { name: "Delete account and data", exact: true })
    .click();
  await expect
    .poll(async () =>
      (
        await request.get("http://127.0.0.1:4100/v1/matches", { headers })
      ).status(),
    )
    .toBe(401);
});
