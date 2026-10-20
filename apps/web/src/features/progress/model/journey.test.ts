import { describe, expect, it } from "vitest";
import { normalizeJourney } from "./journey";
import { adherenceCounts, summaryLines, trendOf } from "./summary";

const full = {
  identity: {
    status: "chosen",
    candidates: [{ steamId: "7", name: "Caio", matches: 4, reviews: 2 }],
  },
  summary: { planAdherenceRate: 0.6 },
  timeline: [
    {
      analysisId: "b",
      playedAt: "2026-10-12T20:00:00Z",
      map: "de_mirage",
      result: { roundsWon: 13, roundsLost: 9, won: true },
      metrics: { adr: 78, kd: 1.3, kast: 74, hsPct: 41 },
      adherence: [
        {
          planItemId: "p1",
          text: "Trade your entry",
          fromAnalysisId: "a",
          status: "applied",
          metric: "tradedDeathsPct",
          before: 20,
          after: 45,
        },
        { planItemId: "p2", text: "Flash for yourself", status: "weird" },
      ],
    },
    {
      analysisId: "a",
      playedAt: "2026-10-10T20:00:00Z",
      map: "de_inferno",
      result: { roundsWon: 7, roundsLost: 13 },
      metrics: { adr: 62, kd: 0.8, kast: 61, hsPct: 30 },
      review: {
        reviewId: "r1",
        tier: "quick",
        verdict: "You died alone.",
        planItems: [
          { id: "p1", text: "Trade your entry", direction: "up" },
          "Flash for yourself",
          { text: "" },
        ],
      },
    },
    { playedAt: "x" },
  ],
  maps: [{ map: "de_mirage" }, "de_nuke"],
};

describe("normalizeJourney", () => {
  it("sorts oldest first, derives deltas and keeps reviews and adherence", () => {
    const j = normalizeJourney(full);
    expect(j.identity).toEqual(full.identity);
    expect(j.timeline.map((n) => n.analysisId)).toEqual(["a", "b"]);
    expect(j.timeline[0]!.result).toEqual({ won: 7, lost: 13, win: false });
    expect(j.timeline[1]!.delta.adr).toBe(16);
    expect(j.timeline[1]!.delta.kd).toBeCloseTo(0.5);
    expect(j.timeline[0]!.review?.planItems.map((p) => p.text)).toEqual([
      "Trade your entry",
      "Flash for yourself",
    ]);
    expect(j.timeline[1]!.adherence[1]!.status).toBe("unknown");
    expect(j.maps).toEqual(["de_mirage", "de_nuke", "de_inferno"]);
    expect(j.adherenceRate).toBe(60);
  });
  it("reads the older flat timeline and identity", () => {
    const j = normalizeJourney({
      playerSteamId: null,
      timeline: [
        {
          analysisId: "x",
          date: "2026-10-01T00:00:00Z",
          adr: 70,
          headshotPercentage: 33,
          openingSuccess: 50,
          roundsWon: 13,
          roundsLost: 13,
        },
      ],
      reviews: [],
      liveCalls: [],
    });
    expect(j.identity).toEqual({ status: "missing", candidates: [] });
    expect(j.timeline[0]!.metrics).toEqual({
      adr: 70,
      hsPct: 33,
      openingWinPct: 50,
    });
    expect(j.timeline[0]!.result?.win).toBeNull();
    expect(j.adherenceRate).toBeNull();
  });
  it("survives garbage", () => {
    const j = normalizeJourney("nope");
    expect(j.timeline).toEqual([]);
    expect(j.identity.status).toBe("missing");
  });
});

describe("trends and summary", () => {
  it("computes trends with lower-is-better metrics", () => {
    const j = normalizeJourney(full);
    expect(trendOf(j.timeline, "adr")).toMatchObject({
      first: 62,
      last: 78,
      direction: "better",
    });
    const low = normalizeJourney({
      timeline: [
        { analysisId: "1", playedAt: "2026-01-01", isolatedDeathsPct: 60 },
        { analysisId: "2", playedAt: "2026-01-02", isolatedDeathsPct: 40 },
      ],
    });
    expect(trendOf(low.timeline, "isolatedDeathsPct")?.direction).toBe(
      "better",
    );
    expect(trendOf(low.timeline, "adr")).toBeNull();
  });
  it("writes plain summary lines", () => {
    const j = normalizeJourney(full);
    expect(adherenceCounts(j.timeline)).toEqual({
      applied: 1,
      partly: 0,
      checked: 1,
      total: 2,
    });
    expect(summaryLines(j.timeline).map((l) => l.text)).toEqual([
      "Over your last {n} matches your ADR went from {from} to {to}.",
      "You applied {applied} of {checked} coach tips.",
    ]);
    expect(summaryLines(j.timeline.slice(0, 1)).map((l) => l.text)).toEqual([
      "Upload your next match to see if you applied the plan.",
    ]);
  });
});
