import { describe, expect, it } from "vitest";
import { FakeHttpClient } from "@/shared/http/FakeHttpClient";
import { createMapsApi } from "./maps.api";

describe("MapsApi", () => {
  it("reads coach progress", async () => {
    const http = new FakeHttpClient().on("GET", "coach/progress", {
      timeline: [],
    });
    await expect(createMapsApi(http).getProgress()).resolves.toEqual({
      timeline: [],
    });
    expect(http.calls[0]!.path).toBe("coach/progress");
  });
  it("rates a review with an encoded id", async () => {
    const http = new FakeHttpClient().on(
      "POST",
      "coach/reviews/r%2F1/rating",
      undefined,
    );
    await createMapsApi(http).rateReview("r/1", 4);
    expect(http.calls[0]!.options.json).toEqual({ rating: 4 });
  });
});
