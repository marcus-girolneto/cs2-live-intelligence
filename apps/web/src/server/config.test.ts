import { describe, expect, it } from "vitest";
import { devAuthAllowed, localDemoToken, simulatorConfig } from "./config";
describe("explicit local identity", () => {
  it("requires both local app environment and opt-in", () => {
    expect(
      devAuthAllowed({
        APP_ENV: "local",
        ENABLE_DEV_AUTH: "true",
        NODE_ENV: "production",
      }),
    ).toBe(true);
    expect(
      devAuthAllowed({ APP_ENV: "production", ENABLE_DEV_AUTH: "true" }),
    ).toBe(false);
    expect(devAuthAllowed({ ENABLE_DEV_AUTH: "true" })).toBe(false);
    expect(devAuthAllowed({ APP_ENV: "local" })).toBe(false);
  });
});
describe("local demo credential", () => {
  it("is only exposed server-side when local dev auth is enabled", () => {
    const local = {
      APP_ENV: "local",
      ENABLE_DEV_AUTH: "true",
      DEV_AUTO_LOGIN: "true",
    };
    expect(localDemoToken({ ...local, WEB_TOKEN: "secret" })).toBe("secret");
    // Sign-in is required unless automatic local login is explicitly enabled.
    expect(
      localDemoToken({
        APP_ENV: "local",
        ENABLE_DEV_AUTH: "true",
        WEB_TOKEN: "secret",
      }),
    ).toBeUndefined();
    expect(localDemoToken(local)).toBeUndefined();
    expect(
      localDemoToken({
        APP_ENV: "production",
        ENABLE_DEV_AUTH: "true",
        WEB_TOKEN: "s",
      }),
    ).toBeUndefined();
    expect(
      localDemoToken({ APP_ENV: "local", WEB_TOKEN: "s" }),
    ).toBeUndefined();
  });
});
describe("local simulator", () => {
  it("requires local dev auth, URL and token", () => {
    const local = { APP_ENV: "local", ENABLE_DEV_AUTH: "true" };
    expect(
      simulatorConfig({
        ...local,
        SIMULATOR_URL: "http://api:3010",
        GSI_AUTH_TOKEN: "t",
      }),
    ).toEqual({ url: "http://api:3010", token: "t" });
    expect(
      simulatorConfig({ ...local, SIMULATOR_URL: "http://api:3010" }),
    ).toBeUndefined();
    expect(
      simulatorConfig({
        APP_ENV: "production",
        ENABLE_DEV_AUTH: "true",
        SIMULATOR_URL: "u",
        GSI_AUTH_TOKEN: "t",
      }),
    ).toBeUndefined();
  });
});
