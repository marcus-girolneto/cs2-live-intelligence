import { describe, expect, it } from "vitest";
import type { LiveState } from "@cs2/contracts";
import {
  baselineFrom,
  emptyTracker,
  liveTips,
  trackRound,
  type RoundRecord,
} from "./liveCoach";

const state = (
  over: Partial<LiveState> & { k?: number; d?: number; armor?: number },
): LiveState => {
  const { k, d, armor, ...rest } = over;
  return {
    schemaVersion: "1.0",
    sessionId: "s",
    source: "gsi",
    visibility: "own-player",
    sequence: 1,
    observedAt: "2026-10-19T00:00:00.000Z",
    receivedAt: "2026-10-19T00:00:00.000Z",
    ...rest,
    ...(k !== undefined || d !== undefined || armor !== undefined
      ? {
          ownStats: {
            ...(k !== undefined ? { kills: k } : {}),
            ...(d !== undefined ? { deaths: d } : {}),
            ...(armor !== undefined ? { armor } : {}),
          },
        }
      : {}),
  };
};

describe("round tracker", () => {
  it("records kills and deaths per round when the counter advances", () => {
    let t = emptyTracker();
    t = trackRound(
      t,
      state({ round: 1, phase: "freezetime", k: 0, d: 0, armor: 0 }),
    );
    t = trackRound(t, state({ round: 1, phase: "live", k: 2, d: 0 }));
    t = trackRound(t, state({ round: 1, phase: "live", k: 2, d: 1 }));
    t = trackRound(t, state({ round: 2, phase: "freezetime", k: 2, d: 1 }));
    expect(t.rounds).toEqual([
      { round: 1, kills: 2, died: true, armorAtStart: 0 },
    ]);
    t = trackRound(t, state({ round: 2, phase: "gameover", k: 3, d: 1 }));
    expect(t.finished).toBe(true);
    expect(t.rounds[1]).toMatchObject({ round: 2, kills: 1, died: false });
  });
  it("skips rounds where stats were not visible instead of guessing", () => {
    let t = emptyTracker();
    t = trackRound(t, state({ round: 1 }));
    t = trackRound(t, state({ round: 2, k: 1, d: 0 }));
    expect(t.rounds).toEqual([]);
  });
  it("ignores snapshots without a round", () => {
    const t = trackRound(emptyTracker(), state({}));
    expect(t).toEqual(emptyTracker());
  });
});

describe("live coach", () => {
  const died = (round: number): RoundRecord => ({
    round,
    kills: 0,
    died: true,
  });
  it("stays quiet during live action", () => {
    const tips = liveTips(
      state({ phase: "live" }),
      [died(1), died(2), died(3)],
      null,
    );
    expect(tips.map((t) => t.id)).toEqual(["focus"]);
  });
  it("warns about death and no-kill streaks between rounds", () => {
    const tips = liveTips(
      state({ phase: "freezetime", round: 5 }),
      [died(1), died(2), died(3), died(4)],
      null,
    );
    expect(tips.map((t) => t.id)).toEqual(
      expect.arrayContaining(["death-streak", "dry"]),
    );
  });
  it("praises hot streaks and flags no-armor rounds", () => {
    const tips = liveTips(
      state({ phase: "freezetime", round: 3, armor: 0 }),
      [
        { round: 1, kills: 2, died: false },
        { round: 2, kills: 1, died: false },
      ],
      null,
    );
    expect(tips.map((t) => t.id)).toEqual(
      expect.arrayContaining(["hot", "no-armor"]),
    );
  });
  it("compares K/D with the baseline only with enough data", () => {
    const base = baselineFrom("sample demo", 10, 10, 20);
    expect(base.kd).toBe(1);
    const above = liveTips(state({ phase: "over", k: 8, d: 2 }), [], base);
    expect(above.map((t) => t.id)).toContain("above-baseline");
    const below = liveTips(state({ phase: "over", k: 2, d: 6 }), [], base);
    expect(below.map((t) => t.id)).toContain("below-baseline");
    const few = liveTips(state({ phase: "over", k: 1, d: 1 }), [], base);
    expect(few.map((t) => t.id)).toEqual(["steady"]);
  });
  it("handles a missing baseline and missing state", () => {
    expect(baselineFrom("x", null, 0, 0)).toMatchObject({
      kd: null,
      killsPerRound: null,
    });
    expect(liveTips(null, [], null)).toEqual([]);
  });
});
