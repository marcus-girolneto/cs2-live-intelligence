import { expect, test, type Page } from "@playwright/test";

// The 402 plan_limit flow with mocked API responses: a Free user runs out of daily AI reviews
// and gets the upgrade sheet (plan, price, CTA) instead of an error. No real API or AI call.
const resetsAt = new Date(Date.now() + 5 * 3600_000).toISOString();
const free = {
  id: "free",
  name: "Free",
  status: "active",
  source: "default",
  limits: {
    aiReviewsPerDay: 1,
    liveAiMatchesPerDay: 0,
    uploadsPerDay: 2,
    retentionDaysMax: 30,
  },
  features: { clipExport: false, perMapLearning: false },
};
async function mockFreeUser(page: Page, credits?: Record<string, unknown>) {
  await page.route("**/api/session", (r) =>
    r.fulfill({ json: { hasSession: true, devLogin: false } }),
  );
  await page.route("**/api/platform/**", async (r) => {
    const path = new URL(r.request().url()).pathname.replace(
      "/api/platform/",
      "",
    );
    const json = (body: unknown, status = 200) =>
      r.fulfill({ status, json: body });
    if (path === "me")
      return json({
        ownerId: "u1",
        steamId: "765",
        role: "user",
        profile: { personaName: "Tester" },
        plan: free,
        ...(credits ? { credits } : {}),
        usage: {
          day: "2026-10-19",
          resetsAt,
          aiReviews: { used: 0, limit: 1 },
          liveAiMatches: { used: 0, limit: 0 },
          uploads: { used: 0, limit: 2 },
        },
      });
    if (path === "matches")
      return json({
        matches: [
          {
            id: "m1",
            filename: "upgrade.dem",
            status: "complete",
            createdAt: new Date().toISOString(),
            analysisId: "a1",
          },
        ],
      });
    if (path === "coach/progress")
      return json({
        playerSteamId: "765",
        linkedToSteam: true,
        analyzedMatches: 1,
        profile: null,
        timeline: [],
        reviews: [],
        liveCalls: [],
      });
    if (path === "analyses/a1")
      return json({
        id: "a1",
        analysis: {
          schemaVersion: "1.0",
          source: "demo",
          map: "de_mirage",
          events: [],
          evidence: [],
          caveats: [],
          players: [{ steamId: "765", name: "Tester" }],
        },
        coaching: {
          schemaVersion: "1.0",
          mode: "offline",
          insights: [],
          caveats: [],
        },
      });
    if (path === "analyses/a1/reviews") return json({ reviews: [] });
    if (path === "credits/packs")
      return json({
        packs: [
          {
            id: "starter",
            name: "Starter",
            credits: 10,
            prices: { BRL: 990, USD: 299 },
          },
        ],
      });
    if (path === "analyses/a1/coaching")
      return json(
        {
          error: "Daily AI review limit reached.",
          code: "plan_limit",
          feature: "ai_review",
          limit: 1,
          resetsAt,
          upgradeTo: "basic",
        },
        402,
      );
    if (path === "plans") return json({ plans: [] });
    if (path === "billing/status") return json({ enabled: false });
    return json({});
  });
}

test("a 402 plan_limit opens the upgrade sheet instead of an error", async ({
  page,
}) => {
  await mockFreeUser(page);
  await page.goto("/coach?match=m1");
  await expect(page.getByTestId("usage-aiReviews")).toContainText(
    "0 of 1 AI reviews used today",
  );
  // Step 3 of the coach: choose the review tier.
  await expect(page.getByTestId("tier-quick")).toBeVisible();
  await page.getByRole("button", { name: /Run Quick review/ }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toContainText("You used 1 of 1 AI reviews today");
  await expect(sheet).toContainText("Basic");
  await expect(sheet).toContainText("$4.99");
  await expect(sheet).toContainText("15 credits every month");
  // Payments not configured yet: no broken checkout button.
  await expect(sheet).toContainText("Coming soon");
  await expect(page.getByText("Daily AI review limit reached.")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
});

test("not enough credits opens the buy-credits sheet instead of running", async ({
  page,
}) => {
  await mockFreeUser(page, {
    balance: 1,
    buckets: { plan: 0, bonus: 1, purchased: 0 },
    welcome: { status: "granted" },
    costs: { quick: 1, deep: 3 },
  });
  await page.addInitScript(() => {
    try {
      localStorage.setItem("fragmind.welcome.u1.granted", "1");
    } catch {
      /* storage unavailable */
    }
  });
  await page.goto("/coach?match=m1");
  const deep = page.getByTestId("tier-deep");
  await expect(deep).toContainText("3");
  await deep.getByRole("button").last().click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toContainText("You need 2 more credits");
  await expect(sheet).toContainText("Starter");
  await expect(sheet).toContainText("$2.99");
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
});
