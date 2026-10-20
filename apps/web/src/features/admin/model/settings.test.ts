import { describe, expect, it } from "vitest";
import {
  productBody,
  productProblems,
  productSettingsOf,
  timeZones,
} from "./settings";

describe("product settings", () => {
  it("reads the server values with defaults", () => {
    expect(productSettingsOf(undefined)).toEqual({
      timezone: "America/Sao_Paulo",
      personalCoachIntervalDays: "",
      personalCoachNewMatches: "",
      maxDemoMb: "",
      verifierEnabled: false,
    });
    expect(
      productSettingsOf({
        timezone: "UTC",
        personalCoachIntervalDays: 7,
        personalCoachNewMatches: 3,
        maxDemoBytes: 524_288_000,
        verifierEnabled: true,
      }),
    ).toEqual({
      timezone: "UTC",
      personalCoachIntervalDays: "7",
      personalCoachNewMatches: "3",
      maxDemoMb: "500",
      verifierEnabled: true,
    });
  });
  it("only sends keys the server knows and validates ranges", () => {
    const p = productSettingsOf({ maxDemoBytes: 1 });
    p.maxDemoMb = "500";
    p.personalCoachIntervalDays = "7";
    expect(
      productBody(p, { maxDemoBytes: 1, personalCoachIntervalDays: 3 }),
    ).toEqual({
      maxDemoBytes: 524_288_000,
      personalCoachIntervalDays: 7,
    });
    expect(productBody(p, { timezone: "UTC" })).toEqual({
      timezone: "America/Sao_Paulo",
    });
    expect(productBody(p, { verifierEnabled: true })).toEqual({
      verifierEnabled: false,
    });
    expect(
      productProblems({
        ...p,
        personalCoachNewMatches: "0",
        maxDemoMb: "2000",
      }),
    ).toEqual({
      personalCoachNewMatches: "Between 1 and 50 matches.",
      maxDemoMb: "Between 1 and 1024 MB.",
    });
    expect(timeZones()).toContain("America/Sao_Paulo");
  });
});
