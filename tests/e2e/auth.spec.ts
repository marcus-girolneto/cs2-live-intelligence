import { expect, test } from "@playwright/test";

// The app works only signed in. Automatic local sign-in is blocked here to see what a
// visitor without a session gets: the Steam sign-in screen on every page.
test("visitors without a session must sign in with Steam", async ({ page }) => {
  await page.route("**/api/demo-session", (route) =>
    route.fulfill({ status: 403, body: JSON.stringify({ error: "disabled" }) }),
  );
  for (const path of ["/", "/demo", "/progress", "/settings"]) {
    await page.goto(path);
    // The landing repeats the call to action at the end of the page.
    await expect(
      page.getByRole("button", { name: "Sign in with Steam" }).first(),
    ).toBeVisible();
    await expect(page.getByRole("navigation")).toHaveCount(0);
    await expect(
      page.getByText("We only receive your public SteamID").first(),
    ).toBeVisible();
  }
  await page.goto("/privacy");
  await expect(
    page.getByRole("button", { name: "Sign in with Steam" }),
  ).toHaveCount(0);
});
