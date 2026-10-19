import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { analyzeDemo } from "@cs2/analytics";
import { liveStateSchema } from "@cs2/contracts";
import { buildReplay } from "./replayFrames";

const analysis = () =>
  analyzeDemo(
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

describe("demo replay", () => {
  it("produces valid live-state frames that end with the demo's totals", () => {
    const a = analysis();
    for (const player of a.players) {
      const frames = buildReplay(a, player.steamId);
      expect(frames.length).toBeGreaterThan(0);
      for (const f of frames)
        expect(liveStateSchema.safeParse(f.state).success).toBe(true);
      const last = frames.at(-1)!.state;
      expect(last.phase).toBe("gameover");
      if (player.kills.complete)
        expect(last.ownStats?.kills).toBe(player.kills.value);
      if (player.deaths.complete)
        expect(last.ownStats?.deaths).toBe(player.deaths.value);
      const wins = (a.roundOutcomes ?? []).filter((r) => r.winner).length;
      expect((last.score?.ct ?? 0) + (last.score?.t ?? 0)).toBe(wins);
      const seq = frames.map((f) => f.state.sequence);
      expect(seq).toEqual([...seq].sort((x, y) => x - y));
      for (const f of frames) {
        const h = f.state.ownStats?.health ?? 0;
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThanOrEqual(100);
        expect(f.feed.length).toBeLessThanOrEqual(6);
      }
    }
  });
  it("returns no frames for a demo without events", () => {
    expect(buildReplay({ ...analysis(), events: [] }, "x")).toEqual([]);
  });
});
