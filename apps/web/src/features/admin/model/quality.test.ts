import { describe, expect, it } from "vitest";
import { normalizeEval, normalizeRatings, normalizeReprocess } from "./quality";

describe("admin quality models", () => {
  it("normalizes reprocess status", () => {
    expect(
      normalizeReprocess({
        pending: 3,
        done: "x",
        failed: -1,
        currentVersion: "p7",
      }),
    ).toEqual({
      pending: 3,
      done: 0,
      failed: 0,
      currentVersion: "p7",
    });
  });
  it("normalizes ratings and the eval summary", () => {
    expect(
      normalizeRatings({
        ratings: [
          {
            purpose: "review_quick",
            variant: "b",
            promptVersion: "v9",
            reviews: 10,
            rated: 4,
            avgRating: 4.25,
          },
          { variant: "a" },
        ],
      }),
    ).toHaveLength(1);
    expect(
      normalizeEval({
        id: "e",
        createdAt: "2026-10-19T00:00:00Z",
        summary: { runs: 6, failed: 1, groundingRate: 0.92 },
      }),
    ).toMatchObject({ runs: 6, groundingRate: 0.92, costUsd: null });
    expect(normalizeEval({})).toBeNull();
  });
});
