import { describe, expect, it } from "vitest";
import {
  uploadErrorMessage,
  etaSeconds,
  percent,
  pushSample,
  RATE_WINDOW_MS,
  splitDuration,
  uploadLimitBytes,
  uploadRate,
} from "./upload";

describe("upload progress math", () => {
  it("smooths the rate over a sliding window", () => {
    let s = pushSample([], { at: 0, loaded: 0 });
    expect(uploadRate(s)).toBeNull();
    s = pushSample(s, { at: 1000, loaded: 1_000_000 });
    expect(uploadRate(s)).toBe(1_000_000);
    s = pushSample(s, { at: RATE_WINDOW_MS + 500, loaded: 9_000_000 });
    // The first sample fell out of the window.
    expect(s[0]!.at).toBe(1000);
    expect(uploadRate(s)).toBe(8_000_000 / 3.5);
  });
  it("ignores too-short windows and stalls", () => {
    expect(
      uploadRate([
        { at: 0, loaded: 0 },
        { at: 100, loaded: 10 },
      ]),
    ).toBeNull();
    expect(
      uploadRate([
        { at: 0, loaded: 5 },
        { at: 2000, loaded: 5 },
      ]),
    ).toBeNull();
  });
  it("computes ETA and percent safely", () => {
    expect(etaSeconds(50, 100, 10)).toBe(5);
    expect(etaSeconds(100, 100, 10)).toBeNull();
    expect(etaSeconds(1, 100, null)).toBeNull();
    expect(percent(1, 3)).toBe(33);
    expect(percent(5, 0)).toBe(0);
    expect(percent(9, 3)).toBe(100);
    expect(splitDuration(125)).toEqual({ m: 2, s: 5 });
  });
});

describe("uploadLimitBytes", () => {
  it("reads the API limit and never exceeds the proxy cap", () => {
    expect(uploadLimitBytes(null, 500)).toBe(500);
    expect(uploadLimitBytes({ uploadMaxBytes: 200 }, 500)).toBe(200);
    expect(uploadLimitBytes({ maxUploadBytes: 200 }, 500)).toBe(200);
    expect(uploadLimitBytes({ limits: { maxUploadBytes: 300 } }, 500)).toBe(
      300,
    );
    expect(
      uploadLimitBytes({ plan: { limits: { maxUploadBytes: 900 } } }, 500),
    ).toBe(500);
    expect(uploadLimitBytes({ maxUploadBytes: "x" }, 500)).toBe(500);
  });
});

describe("uploadErrorMessage", () => {
  it("turns API error codes into friendly messages", () => {
    expect(
      uploadErrorMessage({ status: 400, code: "not_cs2_demo" })?.text,
    ).toMatch(/isn't a CS2 demo/);
    expect(
      uploadErrorMessage({ status: 400, code: "too_small" })?.text,
    ).toMatch(/too short/);
    expect(uploadErrorMessage({ status: 413 })?.text).toMatch(/larger than/);
    expect(uploadErrorMessage({ status: 429 })?.text).toMatch(/too fast/);
    expect(uploadErrorMessage({ status: 402, code: "plan_limit" })).toBeNull();
    expect(uploadErrorMessage(new Error("x"))).toBeNull();
  });
});
