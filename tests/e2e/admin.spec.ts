import { expect, test } from "@playwright/test";

// Runs first (alphabetical). The E2E dev owner is seeded as administrator; the AI provider
// comes from the environment (e2e-mock / e2e/mock-model) until a database profile is assigned.
test("administrators manage AI configuration from the admin area", async ({
  page,
}, info) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Control room" })).toBeVisible(
    { timeout: 20000 },
  );
  await expect(page.getByRole("tab", { name: "AI providers" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  // Active configuration shows provider and model, never the key.
  await expect(page.getByTestId("ai-provider")).toHaveText("e2e-mock");
  await expect(page.getByTestId("ai-model")).toHaveText("e2e/mock-model");
  expect(await page.locator("body").innerText()).not.toContain("e2e-ai-key");
  // A real (mock-provider) connectivity call.
  await page.getByRole("button", { name: "Test connection" }).click();
  await expect(page.getByTestId("ai-test-result")).toContainText(
    "e2e/mock-model answered",
    { timeout: 30000 },
  );
  // The provider editor offers presets and validates JSON before saving.
  await page.getByRole("button", { name: "Add provider" }).first().click();
  await page.getByRole("button", { name: /OpenRouter/ }).click();
  await expect(page.getByLabel("Base URL")).toHaveValue(
    "https://openrouter.ai/api/v1",
  );
  await page.getByText("Advanced options").click();
  await page.getByLabel("Extra headers (JSON)").fill("{not json");
  await expect(page.getByText("Invalid JSON.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add provider", exact: true }).last(),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  // Other sections render for administrators.
  for (const tab of [
    "Model assignment",
    "App settings",
    "Plans",
    "Users & roles",
    "Audit log",
  ]) {
    await page.getByRole("tab", { name: tab }).click();
    await expect(page.getByRole("tab", { name: tab })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  }
  await page.getByRole("tab", { name: "Users & roles" }).click();
  await expect(page.locator(".adm-users tbody tr").first()).toBeVisible();
  // Every user row offers a plan assignment.
  await expect(page.getByLabel(/^Plan of /).first()).toBeVisible();
  await page.getByRole("tab", { name: "Plans" }).click();
  await expect(page.locator(".adm-plan").first()).toBeVisible();
  const body = await page.locator("body").innerText();
  expect(body).not.toMatch(/\bNaN\b|\bundefined\b|Infinity/);
  expect(body).not.toContain("e2e-ai-key");
  await page.screenshot({
    path: info.outputPath("admin.png"),
    fullPage: true,
  });
});
