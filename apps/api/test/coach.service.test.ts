import { describe, it, expect } from "vitest";
import type { LearnedProfile, PreviousPlan } from "@cs2/coaching";
import {
  CoachPlansService,
  groupProgress,
} from "../src/modules/coaching/coach-plans.service.js";
import {
  planItemsOf,
  type CoachPlansRepository,
  type ReviewPlanRecord,
} from "../src/modules/coaching/coach-plans.repository.js";
import { publicCoaching } from "../src/modules/coaching/viewer.policy.js";

const metric = { overall: 80, recent: 80, matches: 1 };
const mapProfile = (lastPlayedAt: string, matches = 1) => ({
  matches,
  rounds: 20 * matches,
  lastPlayedAt,
  metrics: { adr: metric },
  recurring: [{ pattern: "deaths rarely traded", matches }],
  places: [{ place: "Middle", kills: 3, deaths: 4, matches }],
});
const profile = {
  steamId: "p",
  matches: 3,
  rounds: 60,
  maps: { de_mirage: 2, de_inferno: 1 },
  metrics: { adr: metric },
  tendencies: [],
  recurring: [],
  perMap: {
    de_mirage: mapProfile("2026-01-03T00:00:00.000Z", 2),
    de_inferno: mapProfile("2026-01-02T00:00:00.000Z"),
  },
} satisfies LearnedProfile;
const review = (
  reviewId: string,
  map: string,
  createdAt: string,
  items: ReviewPlanRecord["items"],
): ReviewPlanRecord => ({
  reviewId,
  analysisId: "a-" + reviewId,
  steamId: "p",
  map,
  createdAt,
  items,
});

class FakePlans implements CoachPlansRepository {
  constructor(private readonly rows: ReviewPlanRecord[]) {}
  async previousPlans(
    _owner: string,
    _steam: string,
    exclude: string,
  ): Promise<PreviousPlan[]> {
    return this.rows
      .filter((r) => r.analysisId !== exclude)
      .map((r) => ({
        date: r.createdAt.slice(0, 10),
        map: r.map,
        items: r.items,
      }));
  }
  async reviewPlans() {
    return this.rows;
  }
}

describe("coach progress grouped by map", () => {
  const rows = [
    review("r1", "de_inferno", "2026-01-02T00:00:00.000Z", [
      { text: "Smoke Banana early", scope: "map", map: "de_inferno" },
      { text: "Old general", scope: "general" },
    ]),
    review("r2", "de_mirage", "2026-01-03T00:00:00.000Z", [
      { text: "Hold Connector with a trade", scope: "map", map: "de_mirage" },
      { text: "Trade within 5 s", scope: "general" },
    ]),
  ];
  it("groups learned maps (newest first) with each map's open plan items", () => {
    const g = groupProgress(profile, rows);
    expect(g.maps.map((m) => m.map)).toEqual(["de_mirage", "de_inferno"]);
    expect(g.maps[0]).toMatchObject({
      matches: 2,
      lastPlayedAt: "2026-01-03T00:00:00.000Z",
      openPlanItems: [
        { text: "Hold Connector with a trade", scope: "map", map: "de_mirage" },
      ],
      openPlanFrom: { reviewId: "r2" },
      places: [{ place: "Middle" }],
    });
    expect(g.maps[1]!.openPlanItems.map((i) => i.text)).toEqual([
      "Smoke Banana early",
    ]);
    expect(g.generalPlan).toEqual([
      { text: "Trade within 5 s", scope: "general" },
    ]);
    expect(g.generalPlanFrom?.reviewId).toBe("r2");
  });
  it("is empty without a linked player or history", async () => {
    const service = new CoachPlansService(new FakePlans(rows));
    expect(await service.progressByMap("o", null, null)).toEqual({
      maps: [],
      generalPlan: [],
      generalPlanFrom: null,
    });
    const g = await service.progressByMap("o", "p", null);
    expect(g.maps).toEqual([]);
    expect(g.generalPlan).toHaveLength(1);
  });
  it("passes previous plans through the repository interface", async () => {
    const service = new CoachPlansService(new FakePlans(rows));
    const plans = await service.previousPlans("o", "p", "a-r2");
    expect(plans.map((p) => p.map)).toEqual(["de_inferno"]);
  });
});

describe("stored plan items", () => {
  it("reads v5 planItems and treats legacy plans as map items of their match", () => {
    expect(
      planItemsOf(
        {
          plan: ["x"],
          planItems: [
            { text: "a", scope: "map" },
            { text: "b", scope: "general", map: "ignored" },
            { text: 1, scope: "map" },
          ],
        },
        "de_mirage",
      ),
    ).toEqual([
      { text: "a", scope: "map", map: "de_mirage" },
      { text: "b", scope: "general" },
    ]);
    expect(planItemsOf({ plan: ["Legacy", ""] }, "de_nuke")).toEqual([
      { text: "Legacy", scope: "map", map: "de_nuke" },
    ]);
    expect(planItemsOf(null, null)).toEqual([]);
  });
});

describe("model identity stripping", () => {
  it("removes provenance.model from stored coaching", () => {
    expect(
      publicCoaching({
        mode: "provider",
        provenance: { promptVersion: "igl-review-v5", model: "vendor/x" },
      }),
    ).toEqual({
      mode: "provider",
      provenance: { promptVersion: "igl-review-v5" },
    });
    expect(publicCoaching(null)).toBeNull();
    expect(publicCoaching({ mode: "offline" })).toEqual({ mode: "offline" });
  });
});
