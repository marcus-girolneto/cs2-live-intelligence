import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Postgres suites run against the dedicated test database, never DATABASE_URL itself.
    globalSetup: ["./test/support/global-setup.ts"],
  },
});
