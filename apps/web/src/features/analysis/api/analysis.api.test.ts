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
  it("reads lobby ranks and integrity", async () => {
    const http = new FakeHttpClient()
      .on("GET", "analyses/a1/lobby", {
        players: 10,
        metrics: [{ key: "adr", label: "ADR", value: 90, rank: 2 }],
      })
      .on("GET", "analyses/a1/integrity", {
        players: [{ steamId: "x", level: "low", reasons: [] }],
      });
    const api = createAnalysisApi(http);
    expect((await api.getLobby("a1", "765"))[0]!.rank).toBe(2);
    expect(http.calls[0]!.options.query).toEqual({ steamId: "765" });
    expect((await api.getIntegrity("a1")).players).toHaveLength(1);
  });
});
