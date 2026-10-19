import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config/env.js";
import { startAccountJobs } from "../../src/workers/worker-scheduler.js";

describe("dedicated demo worker mode", () => {
  const base = {
    APP_ENV: "local",
    WEB_TOKEN: "w",
    DEVICE_TOKEN: "d",
  };
  it("defaults to in-process processing and accepts external", () => {
    expect(loadConfig(base).demoWorker).toBe("in-process");
    expect(loadConfig({ ...base, DEMO_WORKER: "external" }).demoWorker).toBe(
      "external",
    );
    expect(() => loadConfig({ ...base, DEMO_WORKER: "elsewhere" })).toThrow();
  });
  it("lets the worker boot without development tokens", () => {
    const config = loadConfig({
      APP_ENV: "local",
      ALLOW_DEV_AUTH: "false",
      DATABASE_URL: "postgres://x@y/z",
    });
    expect(config.devAuth).toBeUndefined();
  });
  it("the API in external mode only runs the account jobs", async () => {
    let runs = 0;
    const handle = startAccountJobs(
      {
        run: async () => {
          runs++;
        },
      },
      { disableWorker: true },
    );
    await handle.runOnce();
    await handle.cleanup();
    await handle.maintenance();
    expect(runs).toBe(0);
    await handle.daily();
    expect(runs).toBe(1);
    await handle.stop();
  });
});
