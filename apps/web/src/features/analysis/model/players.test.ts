import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { analyzeDemo } from "@cs2/analytics";
import { mainSide, metricValue, nameMap, roundsForEvents } from "./players";

const a = analyzeDemo(
  JSON.parse(
    readFileSync(
      new URL(
        "../../../../../../packages/contracts/fixtures/normalized-demo.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ),
);

describe("player helpers", () => {
  it("returns null for incomplete or non-finite metrics", () => {
    const p = structuredClone(a.players[0]!);
    p.adr.complete = false;
    expect(metricValue(p, "adr")).toBeNull();
    p.kills.value = Number.NaN;
    expect(metricValue(p, "kills")).toBeNull();
    expect(metricValue(p, "unknown-metric")).toBeNull();
  });
  it("reads advanced metrics", () => {
    const p = a.players[0]!;
    expect(metricValue(p, "kast")).toBe(p.advanced!.kast!.value);
  });
  it("names players with a fallback", () => {
    const names = nameMap(
      [
        { ...a.players[0]!, name: "  " },
        { ...a.players[1]!, name: "Ace" },
      ],
      (n) => `Player ${n}`,
    );
    expect([...names.values()]).toEqual(["Player 1", "Ace"]);
  });
  it("finds sides and evidence rounds", () => {
    for (const p of a.players)
      expect(["CT", "T", null]).toContain(mainSide(p, a.events ?? []));
    const ids = (a.events ?? []).slice(0, 3).map((e) => e.id);
    expect(roundsForEvents([...ids, "missing"], a.events ?? [])).toEqual(
      [...new Set((a.events ?? []).slice(0, 3).map((e) => e.round))].sort(
        (x, y) => x - y,
      ),
    );
  });
});
