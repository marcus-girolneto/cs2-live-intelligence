import { describe, expect, it } from "vitest";
import type { Progress } from "./progress";
import { generalPlanOf, mapKey, mapsOf, planFor } from "./maps";

const base: Progress = {
  playerSteamId: "1",
  linkedToSteam: true,
  analyzedMatches: 3,
  profile: null,
  timeline: [
    {
      analysisId: "a1",
      date: "2026-10-01T00:00:00Z",
      map: "de_mirage",
      adr: 60,
      kills: 10,
      deaths: 12,
    },
    {
      analysisId: "a2",
      date: "2026-10-02T00:00:00Z",
      map: "de_inferno",
      adr: 90,
      kills: 20,
      deaths: 10,
    },
    {
      analysisId: "a3",
      date: "2026-10-03T00:00:00Z",
      map: "de_mirage",
      adr: 80,
      kills: 15,
      deaths: 15,
    },
  ],
  reviews: [
    {
      id: "r1",
      analysisId: "a3",
      filename: "x.dem",
      createdAt: "2026-10-03T00:00:00Z",
      rating: null,
      coaching: {
        planItems: [
          { text: "Trade your entries", scope: "general" },
          { text: "Smoke Jungle first", scope: "map", map: "de_mirage" },
        ],
      },
    },
  ],
  liveCalls: [],
};

describe("per-map progress", () => {
  it("derives maps, metrics and open items from the timeline when the API has no maps", () => {
    const maps = mapsOf(base);
    expect(maps.map((m) => m.map)).toEqual(["de_mirage", "de_inferno"]);
    expect(maps[0]!.metrics.adr).toEqual({
      overall: 70,
      recent: 70,
      matches: 2,
    });
    expect(maps[0]!.openPlanItems.map((i) => i.text)).toEqual([
      "Smoke Jungle first",
    ]);
    expect(maps[1]!.openPlanItems).toEqual([]);
    expect(generalPlanOf(base).map((i) => i.text)).toEqual([
      "Trade your entries",
    ]);
    expect(planFor(base, "de_mirage").map).toHaveLength(1);
    expect(planFor(base, null).map).toEqual([]);
  });
  it("prefers the API maps and generalPlan, and treats legacy plans as general", () => {
    const p = {
      ...base,
      maps: [
        {
          map: "de_nuke",
          matches: 4,
          lastPlayedAt: "2026-10-05T00:00:00Z",
          metrics: { adr: { overall: 70, recent: 75, matches: 4 } },
          recurring: [{ pattern: "dies early", matches: 3 }],
          openPlanItems: [{ text: "Hold ramp" }],
        },
        { map: "" },
      ],
      generalPlan: [{ text: "Warm up" }, "Communicate"],
    } as Progress;
    const maps = mapsOf(p);
    expect(maps).toHaveLength(1);
    expect(maps[0]!.openPlanItems[0]).toEqual({
      text: "Hold ramp",
      scope: "map",
      map: "de_nuke",
    });
    expect(generalPlanOf(p).map((i) => i.text)).toEqual([
      "Warm up",
      "Communicate",
    ]);
    const legacy = {
      ...base,
      reviews: [{ ...base.reviews[0]!, coaching: { plan: ["Old plan"] } }],
    };
    expect(generalPlanOf(legacy)).toEqual([
      { text: "Old plan", scope: "general" },
    ]);
    expect(mapKey("DE_Mirage")).toBe("de_mirage");
    expect(mapKey("../x")).toBeNull();
  });
});
