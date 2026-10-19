import { describe, expect, it } from "vitest";
import {
  aimLines,
  compareToLobby,
  mapLines,
  overviewLines,
  roundLines,
} from "./plain";

describe("plain-language readings", () => {
  it("compares with the lobby using a ±10% band", () => {
    expect(compareToLobby(120, 68)).toBe("above");
    expect(compareToLobby(60, 68)).toBe("below");
    expect(compareToLobby(70, 68)).toBe("about");
    expect(compareToLobby(5, 8, true)).toBe("above");
    expect(compareToLobby(null, 68)).toBeNull();
    expect(compareToLobby(5, 0)).toBeNull();
  });
  it("writes the overview", () => {
    const l = overviewLines({
      adr: 120.7,
      adrRef: 68.6,
      deaths: 5,
      tradedPct: 40,
      openingWon: 2,
      openingLost: 0,
    });
    expect(l.map((x) => x.text)).toEqual([
      "You dealt {adr} damage per round, more than the lobby average ({avg}).",
      "{n} of your {d} deaths weren't traded — you were often fighting alone.",
      "You won {w} of {n} opening duels (the first fight of a round).",
    ]);
    expect(l[0]!.params).toEqual({ adr: 121, avg: 69 });
    expect(l[1]!.params).toEqual({ n: 3, d: 5 });
    expect(
      overviewLines({
        adr: null,
        adrRef: null,
        deaths: 0,
        tradedPct: null,
        openingWon: null,
        openingLost: null,
      }),
    ).toEqual([]);
  });
  it("writes the aim reading with the body part to fix", () => {
    const l = aimLines({
      accuracy: 39,
      accuracyRef: 19,
      headShare: 17,
      headRef: 30,
      hitgroups: { head: 5, chest: 10, stomach: 10, arms: 2, legs: 2 },
    });
    expect(l[0]!.text).toMatch(/twice/);
    expect(l[1]!.params).toMatchObject({ h: 17, r: 30, part: "chest" });
  });
  it("writes map and round readings", () => {
    expect(
      mapLines(
        { place: "Middle", kills: 3, deaths: 1 },
        { place: "Bombsite A", kills: 2, deaths: 3 },
      ).length,
    ).toBe(2);
    const r = roundLines([
      { round: 1, won: true, damage: 100, kills: 1, died: true, traded: true },
      {
        round: 2,
        won: false,
        damage: 139,
        kills: 2,
        died: true,
        traded: false,
      },
      { round: 3, won: true, damage: 97, kills: 1 },
    ]);
    expect(r[0]!.params).toEqual({ w: 2, n: 3 });
    expect(r[1]!.params).toMatchObject({ r: 2 });
    expect(r[2]!.params).toEqual({ list: "2" });
  });
});
