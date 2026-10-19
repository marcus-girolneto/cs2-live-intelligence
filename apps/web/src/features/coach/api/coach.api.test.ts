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
      json: { steamId: "765", lang: "pt" },
      timeoutMs: 600000,
    });
  });
});
