import { describe, expect, it } from "vitest";
import { FakeHttpClient } from "@/shared/http/FakeHttpClient";
import { createCoachApi } from "./coach.api";

describe("CoachApi", () => {
  it("lists matches (empty when absent)", async () => {
    const http = new FakeHttpClient().on("GET", "matches", {});
    await expect(createCoachApi(http).listMatches()).resolves.toEqual([]);
  });
  it("requests a review with the AI timeout", async () => {
    const http = new FakeHttpClient().on("POST", "analyses/a%2F1/coaching", {
      reviewId: "r",
      coaching: {},
    });
    await createCoachApi(http).requestReview("a/1", "765", "pt");
    expect(http.calls[0]!.options).toMatchObject({
      json: { steamId: "765", lang: "pt", tier: "quick" },
      timeoutMs: 600000,
    });
  });
  it("sends the review tier", async () => {
    const http = new FakeHttpClient().on("POST", "analyses/a/coaching", {
      reviewId: "r",
      coaching: {},
    });
    await createCoachApi(http).requestReview("a", "765", "en", "deep");
    expect(http.calls[0]!.options.json).toMatchObject({ tier: "deep" });
  });
  it("lists stored reviews per player, newest first", async () => {
    const http = new FakeHttpClient().on("GET", "analyses/a/reviews", {
      reviews: [
        {
          id: "q",
          tier: "quick",
          createdAt: "2026-10-01T00:00:00Z",
          coaching: {},
        },
        {
          id: "d",
          tier: "deep",
          createdAt: "2026-10-02T00:00:00Z",
          coaching: {},
        },
        { id: "x", tier: "other", createdAt: "2026-09-01T00:00:00Z" },
        { tier: "deep" },
      ],
    });
    const list = await createCoachApi(http).listReviews("a", "765");
    expect(http.calls[0]!.options.query).toEqual({ steamId: "765" });
    expect(list.map((r) => [r.id, r.tier])).toEqual([
      ["d", "deep"],
      ["q", "quick"],
      ["x", null],
    ]);
  });
  it("reads the match reel clips in round order", async () => {
    const http = new FakeHttpClient().on("GET", "analyses/a/reel", {
      clips: [
        { round: 5, from: 10, to: 20, kind: "highlight", label: "Ace" },
        { round: 2, from: 30, to: 38, kind: "mistake" },
        { round: "x" },
      ],
    });
    const clips = await createCoachApi(http).getReel("a", "765");
    expect(clips.map((c) => [c.round, c.kind])).toEqual([
      [2, "mistake"],
      [5, "highlight"],
    ]);
  });
});
