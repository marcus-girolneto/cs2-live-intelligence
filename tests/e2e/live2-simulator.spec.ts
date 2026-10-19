import { expect, test } from "@playwright/test";

// Runs after live.spec (alphabetical) and before platform.spec deletes the account.
test("simulated match flows through collector, API and WebSocket into the second screen", async ({
  page,
}, info) => {
  await page.goto("/live");
  const simulate = page.getByRole("button", { name: "Simulate a match" });
  await expect(simulate).toBeVisible({ timeout: 20000 });
  await simulate.click();
  // The page attaches to the freshly updated session on its own.
  await expect(page.getByTestId("connection-status")).toHaveText("Live", {
    timeout: 20000,
  });
  await expect(page.locator(".hud-badge")).toContainText("SIMULATED");
  await expect(page.getByTestId("map")).toHaveText("Mirage");
  await expect(page.getByText(/Simulated match · round/)).toBeVisible();
  // Rounds finish and the live coach responds between them.
  await expect(page.locator(".timeline li").first()).toBeVisible({
    timeout: 30000,
  });
  await expect(page.locator(".tips li").first()).toBeVisible();
  // The AI IGL makes one real (mock-provider) call per completed round, between rounds.
  await expect(page.getByTestId("ai-live-call")).toContainText("Mock IGL", {
    timeout: 30000,
  });
  for (const id of ["kills", "deaths", "health", "score-ct", "score-t"])
    await expect(page.getByTestId(id)).toHaveText(/^\d+$/);
  const body = await page.locator("body").innerText();
  expect(body).not.toMatch(/\bNaN\b|\bundefined\b|Infinity/);
  await page.screenshot({
    path: info.outputPath("second-screen-simulated.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Stop simulation" }).click();
  await expect(page.getByText(/Simulated match · round/)).toBeHidden({
    timeout: 10000,
  });
});
