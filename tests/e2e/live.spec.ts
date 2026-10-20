import { test, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
function mock() {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(
      "go",
      [
        "run",
        "./cmd/mock",
        "-url",
        "http://127.0.0.1:3102/gsi",
        "-token",
        "e2e-gsi-secret",
        "-count",
        "100",
        "-interval",
        "10ms",
        "-reconnect-at",
        "50",
        "-reconnect-pause",
        "100ms",
      ],
      { cwd: "apps/collector", stdio: ["ignore", "pipe", "pipe"] },
    );
    let output = "";
    child.stdout.on("data", (d) => (output += d));
    child.stderr.on("data", (d) => (output += d));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(output)),
    );
  });
}
test("100 mock updates cross collector, API and owner WebSocket into browser", async ({
  page,
  request,
}, testInfo) => {
  await page.addInitScript(() => {
    const Original = window.WebSocket;
    const sockets: WebSocket[] = [];
    Object.assign(window, { __testSockets: sockets });
    window.WebSocket = class extends Original {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        sockets.push(this);
      }
    };
  });
  // Local mode authenticates server-side; no token is typed into the browser.
  await page.goto("/live");
  await page.getByText("Advanced: connect to a specific session").click();
  await page.getByLabel("Session ID").fill("dev-session");
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.getByTestId("connection-status")).toContainText(
    /^(Waiting for game data|Live)$/,
  );
  await mock();
  await expect
    .poll(async () => {
      const r = await request.get(
        "http://127.0.0.1:4100/v1/live/sessions/dev-session",
        { headers: { Authorization: "Bearer e2e-browser-secret" } },
      );
      return r.ok() ? (await r.json()).sequence : 0;
    })
    .toBe(100);
  await expect(page.getByTestId("map")).toHaveText("Dust II");
  await expect(page.getByTestId("phase")).toHaveText("Game over");
  await expect(page.getByTestId("kills")).toHaveText("20");
  // Directly time one complete local transport path, with real browser rendering as the end point.
  const started = Date.now();
  const response = await request.post("http://127.0.0.1:3102/gsi", {
    data: {
      auth: { token: "e2e-gsi-secret" },
      provider: { steamid: "self" },
      map: { name: "de_dust2", round: 11 },
      player: { steamid: "self", match_stats: { kills: 21 } },
    },
  });
  expect(response.status()).toBe(202);
  await expect(page.getByTestId("kills")).toHaveText("21", { timeout: 1900 });
  const latencyMs = Date.now() - started;
  expect(latencyMs).toBeLessThan(2000);
  const latencyPath = testInfo.outputPath("latency.json");
  await writeFile(
    latencyPath,
    JSON.stringify(
      { collectorToRenderedBrowserMs: latencyMs, simulatedUpdates: 100 },
      null,
      2,
    ),
  );
  await testInfo.attach("latency.json", {
    path: latencyPath,
    contentType: "application/json",
  });
  await page.screenshot({
    path: testInfo.outputPath("live-dashboard.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("kills")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("mobile-dashboard.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  // A minimal snapshot must remove previously displayed statistics.
  await request.post("http://127.0.0.1:3102/gsi", {
    data: { auth: { token: "e2e-gsi-secret" } },
  });
  await expect(page.getByTestId("kills")).toHaveText("–");
  await expect(page.getByTestId("map")).toHaveText("–");
  await page.screenshot({
    path: testInfo.outputPath("dashboard.png"),
    fullPage: true,
  });
  await expect(page.getByTestId("connection-status")).toContainText(/stale/i, {
    timeout: 8000,
  });
  // Force a real socket close; automatic reconnect must use a fresh single-use ticket.
  const previousCount = await page.evaluate(
    () =>
      (window as unknown as { __testSockets: WebSocket[] }).__testSockets
        .length,
  );
  await page.evaluate(() => {
    const sockets = (window as unknown as { __testSockets: WebSocket[] })
      .__testSockets;
    sockets[sockets.length - 1].close();
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { __testSockets: WebSocket[] }).__testSockets
            .length,
      ),
    )
    .toBeGreaterThan(previousCount);
  await request.post("http://127.0.0.1:3102/gsi", {
    data: {
      auth: { token: "e2e-gsi-secret" },
      map: { name: "de_dust2", round: 12 },
    },
  });
  await expect(page.getByTestId("map")).toHaveText("Dust II");
});
