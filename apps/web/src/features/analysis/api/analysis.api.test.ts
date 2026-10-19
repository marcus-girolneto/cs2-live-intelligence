import { describe, expect, it } from "vitest";
import { FakeHttpClient } from "@/shared/http/FakeHttpClient";
import { createAnalysisApi } from "./analysis.api";

describe("AnalysisApi", () => {
  it("reads an analysis by encoded id", async () => {
    const http = new FakeHttpClient().on("GET", "analyses/a%2Fb", {
      id: "a/b",
    });
    await expect(createAnalysisApi(http).getAnalysis("a/b")).resolves.toEqual({
      id: "a/b",
    });
  });
  it("links and unlinks the coached player", async () => {
    const http = new FakeHttpClient().on("PUT", "coach/profile", undefined);
    const api = createAnalysisApi(http);
    await api.setCoachPlayer("765");
    await api.setCoachPlayer(null);
    expect(http.calls.map((c) => c.options.json)).toEqual([
      { playerSteamId: "765" },
      { playerSteamId: null },
    ]);
  });
});
