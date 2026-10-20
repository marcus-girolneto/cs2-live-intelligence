import { describe, expect, it } from "vitest";
import { TrainingService } from "../../src/modules/training/training.service.js";

const metric = (value: number) => ({
  value,
  numerator: value,
  denominator: 1,
  complete: true,
  formula: "x",
  evidenceIds: [],
});
const analysis = (map: string) => ({
  schemaVersion: "1.0",
  source: "demo",
  map,
  events: [],
  players: [
    {
      steamId: "me",
      kills: metric(1),
      deaths: metric(1),
      adr: metric(60),
      headshotPercentage: metric(20),
    },
  ],
  evidence: [],
  caveats: [],
});

function service(over: { playerSteamId?: string | null } = {}) {
  const docs = new Map([
    ["a1", analysis("de_mirage")],
    ["a2", analysis("de_dust2")],
  ]);
  return new TrainingService({
    analyses: {
      analysis: async (owner, id) =>
        owner === "o" && docs.has(id)
          ? { id, analysis: docs.get(id) }
          : undefined,
    },
    replays: { read: async () => undefined },
    reviews: {
      latest: async (_o, id) =>
        id === "a1"
          ? {
              planItems: [
                {
                  text: "x",
                  scope: "map",
                  targetMetric: "utilityDamagePerRound",
                },
              ],
            }
          : undefined,
      playerSteamId: async () =>
        over.playerSteamId === undefined ? "me" : over.playerSteamId,
    },
    recent: {
      recent: async () => [
        { id: "a1", createdAt: "2026-10-02", analysis: docs.get("a1") },
        { id: "bad", createdAt: "2026-10-01", analysis: { nope: 1 } },
        { id: "a2", createdAt: "2026-09-30", analysis: docs.get("a2") },
      ],
    },
  });
}

describe("TrainingService", () => {
  it("uses the newest stored review to rank skills and builds the plan", async () => {
    const plan = await service().plan("o", "a1", "me");
    expect(plan.focus[0]).toBe("utility");
    expect(plan.map).toBe("de_mirage");
    await expect(service().plan("x", "a1", "me")).rejects.toThrow(
      "Analysis not found",
    );
    await expect(service().plan("o", "a1", "ghost")).rejects.toThrow(
      "Player not found",
    );
  });

  it("never fails a review response: attach swallows errors", async () => {
    expect(await service().attach("x", "a1", "me")).toEqual({});
    const ok = await service().attach("o", "a2", "me", {
      planItems: [{ text: "x", scope: "map", targetMetric: "hsPct" }],
    });
    expect(ok.training?.focus[0]).toBe("aim");
  });

  it("recommends from the newest matches, skipping unreadable ones", async () => {
    const rec = await service().recommended("o");
    expect(rec.latest?.analysisId).toBe("a1");
    expect(rec.matches).toBe(2);
    expect(rec.focus).toEqual(["aim", "utility"]);
    expect(rec.week).toHaveLength(7);
    expect(
      (await service({ playerSteamId: null }).recommended("o")).latest,
    ).toBeNull();
  });

  it("serves only verified catalog entries", () => {
    const c = service().catalog();
    expect(c.entries.length).toBeGreaterThanOrEqual(20);
    expect(c.entries.every((e) => !e.workshopId || e.verified)).toBe(true);
  });
});
