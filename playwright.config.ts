import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 10000 },
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    video: "on",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node --import tsx scripts/e2e-stack.ts",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    gracefulShutdown: { signal: "SIGTERM", timeout: 10000 },
    timeout: 120000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
