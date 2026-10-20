import { describe, expect, it } from "vitest";
import type { Analysis } from "@cs2/contracts";
import {
  buildJourney,
  judge,
  planItemsView,
  trendOf,
  type JourneyMatch,
} from "../../src/modules/coaching/progress.model.js";
import { classifyOwnership } from "../../src/modules/coaching/ownership.policy.js";
import { identityOf } from "../../src/modules/coaching/progress.service.js";

type Player = Analysis["players"][number];
const metric = (value: number, numerator = value, denominator = 1) => ({
  value,
  numerator,
  denominator,
  complete: true,
  formula: "",
  evidenceIds: [],
});
const player = (o: {
  adr: number;
  traded: number;
  deaths?: number;
  rounds?: number;
  wins?: number;
}): Player => ({
  steamId: "me",
  kills: metric(10),
  deaths: metric(o.deaths ?? 10),
  adr: metric(o.adr),
  headshotPercentage: metric(40, 4, 10),
  advanced: {
    kast: metric(70, 14, 20),
    "traded-deaths": metric(o.traded, 3, o.deaths ?? 10),
  },
  rounds: Array.from({ length: o.rounds ?? 20 }, (_, i) => ({
    round: i + 1,
    kills: 0,
    headshots: 0,
    damage: 0,
    died: false,
    traded: false,
    damageAssist: false,
    won: i < (o.wins ?? 11),
  })),
});
const match = (
  id: string,
  day: number,
  p: Player,
  plan?: {
    text: string;
    scope: string;
    targetMetric?: string;
    direction?: string;
  }[],
  map = "de_dust2",
): JourneyMatch => ({
  analysisId: id,
  createdAt: `2026-01-${String(day).padStart(2, "0")}T10:00:00.000Z`,
  map,
  player: p,
  ...(plan
    ? {
        review: {
          reviewId: `r-${id}`,
          tier: "quick" as const,
          createdAt: `2026-01-${String(day).padStart(2, "0")}T11:00:00.000Z`,
          coaching: { verdict: "v", planItems: plan },
        },
      }
    : {}),
});

describe("progress journey", () => {
  it("orders matches oldest first with deltas, review plan items and adherence", () => {
    const j = buildJourney([
      match("b", 2, player({ adr: 80, traded: 40 })),
      match("a", 1, player({ adr: 70, traded: 20 }), [
        { text: "Trade your entry", scope: "general" },
        {
          text: "Hold B with a crossfire",
          scope: "map",
          targetMetric: "kast",
          direction: "up",
        },
      ]),
      match("c", 3, player({ adr: 60, traded: 25 }), undefined, "de_mirage"),
    ]);
    expect(j.timeline.map((t) => t.analysisId)).toEqual(["a", "b", "c"]);
    expect(j.timeline[0]!.dateSource).toBe("upload");
    expect(j.timeline[1]!.deltaVsPrevious.adr).toBe(10);
    expect(j.timeline[0]!.review!.planItems[0]).toMatchObject({
      id: "r-a:0",
      targetMetric: "tradedDeathsPct",
      direction: "up",
    });
    // Next match: the trade item improved by 20 points (applied), KAST did not move.
    expect(j.timeline[1]!.adherence!.map((a) => a.status)).toEqual([
      "applied",
      "not_applied",
    ]);
    // Another map: only the general item is judged there.
    expect(j.timeline[2]!.adherence!.map((a) => a.planItemId)).toEqual([
      "r-a:0",
    ]);
    expect(j.timeline[2]!.adherence![0]!.status).toBe("partly");
    expect(j.summary.planAdherenceRate).toBe(0.5);
    expect(j.summary.bestMatch!.analysisId).toBe("b");
    expect(j.summary.worstMatch!.analysisId).toBe("c");
    expect(j.summary.streak).toEqual({ kind: "win", count: 3 });
    expect(j.summary.trend.adr).toMatchObject({ n: 3, confidence: "low" });
  });
  it("is unknown when the metric is missing or the sample is too small", () => {
    const [item] = planItemsView(
      "r",
      { planItems: [{ text: "Trade more", scope: "general" }] },
      null,
    );
    const small = {
      values: { tradedDeathsPct: 10 },
      samples: { tradedDeathsPct: 2 },
    };
    const big = {
      values: { tradedDeathsPct: 50 },
      samples: { tradedDeathsPct: 6 },
    };
    expect(judge(item!, "x", small, big).status).toBe("unknown");
    expect(judge(item!, "x", { values: {}, samples: {} }, big).status).toBe(
      "unknown",
    );
    expect(
      judge(item!, "x", { ...big, values: { tradedDeathsPct: 10 } }, big),
    ).toMatchObject({
      status: "applied",
      before: 10,
      after: 50,
      threshold: 10,
    });
  });
  it("infers targets for legacy plan strings", () => {
    expect(
      planItemsView("r", { plan: ["Não jogue sozinho"] }, "de_nuke")[0],
    ).toMatchObject({
      scope: "map",
      map: "de_nuke",
      targetMetric: "isolatedDeathsPct",
      direction: "down",
    });
  });
  it("computes slope trends", () => {
    expect(trendOf([1, 2, 3, 4])).toMatchObject({
      slope: 1,
      n: 4,
      confidence: "medium",
    });
    expect(trendOf([5])).toBeUndefined();
  });
});

describe("match ownership", () => {
  const players = [{ steamId: "765" }, { steamId: "999" }];
  it("matches the account Steam ID first, then the saved choice, else external", () => {
    expect(
      classifyOwnership(players, { steamId: "765", chosenSteamId: "999" }),
    ).toEqual({ ownership: "mine", playerSteamId: "765", matchedBy: "steam" });
    expect(
      classifyOwnership(players, { steamId: "111", chosenSteamId: "999" }),
    ).toEqual({ ownership: "mine", playerSteamId: "999", matchedBy: "chosen" });
    expect(
      classifyOwnership(players, { steamId: "111", chosenSteamId: null }),
    ).toEqual({
      ownership: "external",
      playerSteamId: null,
      matchedBy: "none",
    });
  });
  it("keeps manual overrides and per-match choices", () => {
    const account = { steamId: null, chosenSteamId: "999" };
    expect(
      classifyOwnership(players, account, {
        ownership: "external",
        playerSteamId: null,
        matchedBy: "user",
      }).ownership,
    ).toBe("external");
    expect(
      classifyOwnership(players, account, {
        ownership: "mine",
        playerSteamId: "765",
        matchedBy: "chosen",
      }).playerSteamId,
    ).toBe("765");
  });
  it("reports the identity status and candidates", () => {
    const rosters = [
      [{ steamId: "5", name: "Five" }],
      [{ steamId: "5" }, { steamId: "6" }],
    ];
    const reviews = [
      { steamId: "6" },
      { steamId: "5" },
      { steamId: "5" },
    ] as never;
    expect(identityOf([], rosters, reviews)).toEqual({
      status: "missing",
      candidates: [
        { steamId: "5", name: "Five", matches: 2, reviews: 2 },
        { steamId: "6", matches: 1, reviews: 1 },
      ],
    });
  });
});
