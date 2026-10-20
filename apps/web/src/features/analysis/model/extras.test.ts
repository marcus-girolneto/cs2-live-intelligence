import { describe, expect, it } from "vitest";
import {
  banText,
  flaggedIds,
  normalizeIntegrity,
  normalizeLobby,
  reasonText,
} from "./extras";

describe("lobby ranks", () => {
  it("keeps ranked metrics, best relative rank first", () => {
    const m = normalizeLobby({
      players: 10,
      metrics: [
        {
          key: "adr",
          label: "ADR",
          unit: "",
          value: 121,
          rank: 1,
          lobbyMedian: 70,
          best: 121,
          players: 10,
        },
        {
          key: "hs",
          label: "HS%",
          unit: "%",
          value: 36,
          rank: 6,
          lobbyMedian: 40,
          best: 60,
        },
        { key: "kast", label: "KAST", value: null, rank: null },
        { key: "x", value: 3, rank: 0 },
      ],
    });
    expect(m.map((x) => x.key)).toEqual(["adr", "hs"]);
    expect(m[1]!.players).toBe(10);
    expect(normalizeLobby(null)).toEqual([]);
  });
});

describe("integrity", () => {
  const raw = {
    players: [
      { steamId: "a", level: "none", reasons: [] },
      {
        steamId: "b",
        level: "elevated",
        reasons: [
          { code: "inhuman_snaps", value: 3, threshold: 2, n: 14 },
          { code: "reaction_time", value: 0.12, n: 11 },
        ],
      },
    ],
    bannedAfterMatch: [
      {
        steamId: "c",
        vacBans: 1,
        gameBans: 0,
        daysSinceLastBan: 2,
        bannedAfterMatch: true,
      },
      {
        steamId: "d",
        vacBans: 1,
        daysSinceLastBan: 900,
        bannedAfterMatch: false,
      },
    ],
    checkedAt: "2026-10-19T00:00:00Z",
  };
  it("keeps only flagged players and bans after the match", () => {
    const i = normalizeIntegrity(raw);
    expect(i.players.map((p) => p.steamId)).toEqual(["b"]);
    expect(i.bans.map((b) => b.steamId)).toEqual(["c"]);
    expect([...flaggedIds(i)]).toEqual(["b", "c"]);
    expect(flaggedIds(null).size).toBe(0);
  });
  it("explains reasons and bans in neutral words", () => {
    const i = normalizeIntegrity(raw);
    expect(reasonText(i.players[0]!.reasons[0]!).params).toEqual({
      k: 3,
      n: 14,
    });
    expect(reasonText(i.players[0]!.reasons[1]!).params).toMatchObject({
      ms: 120,
    });
    expect(
      reasonText({ code: "?", value: null, threshold: null, n: null }).text,
    ).toBe("Statistically unusual play");
    const now = Date.parse("2026-10-20T00:00:00Z");
    const match = Date.parse("2026-10-14T00:00:00Z");
    expect(banText(i.bans[0]!, match, now)).toEqual({
      text: "Account banned by VAC {d} days after this match",
      params: { d: 4 },
    });
    const all = JSON.stringify([
      reasonText(i.players[0]!.reasons[0]!),
      banText(i.bans[0]!, null),
    ]);
    expect(all).not.toMatch(/cheat|hack/i);
  });
});
