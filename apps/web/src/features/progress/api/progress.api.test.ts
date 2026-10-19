import { describe, expect, it } from "vitest";
import { FakeHttpClient } from "@/shared/http/FakeHttpClient";
import { createProgressApi } from "./progress.api";

describe("progress api", () => {
  it("loads the journey (optionally per map) and sets the identity", async () => {
    const http = new FakeHttpClient()
      .on("GET", "coach/progress?map=de_mirage", {
        timeline: [{ analysisId: "a", playedAt: "2026-01-01", adr: 70 }],
      })
      .on("PUT", "coach/identity", {});
    const api = createProgressApi(http);
    const j = await api.getJourney("de_mirage");
    expect(j.timeline[0]!.metrics.adr).toBe(70);
    await api.setIdentity("765");
    expect(http.calls.map((c) => [c.method, c.path])).toEqual([
      ["GET", "coach/progress?map=de_mirage"],
      ["PUT", "coach/identity"],
    ]);
    expect(http.calls[1]!.options.json).toEqual({
      steamId: "765",
      analysisIds: "all",
    });
  });
});
