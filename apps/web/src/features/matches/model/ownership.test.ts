import { describe, expect, it } from "vitest";
import type { MatchDto } from "@/shared/api-types";
import {
  autoReviewLabel,
  filterMatches,
  mineFirst,
  normalizeAutoReviews,
  normalizeOwnership,
} from "./ownership";

const NOW = Date.parse("2026-10-20T00:00:00Z");
const m = (id: string, daysAgo: number) =>
  ({
    id,
    analysisId: `a${id}`,
    status: "complete",
    filename: `${id}.dem`,
    createdAt: new Date(NOW - daysAgo * 86_400_000).toISOString(),
  }) as unknown as MatchDto;

describe("ownership", () => {
  it("normalizes ownership and auto-review items defensively", () => {
    const o = normalizeOwnership({
      items: [
        {
          jobId: "1",
          ownership: "mine",
          playerName: "Caio",
          matchedBy: "steam",
        },
        { jobId: "2", ownership: "weird" },
        { ownership: "mine" },
      ],
    });
    expect(o.get("1")).toMatchObject({ ownership: "mine", playerName: "Caio" });
    expect(o.get("2")?.ownership).toBeNull();
    expect(o.size).toBe(2);
    const a = normalizeAutoReviews({
      items: [
        { jobId: "1", status: "done", reviewId: "r" },
        { jobId: "2", status: "skipped", reason: "insufficient_credits" },
        { jobId: "3", status: "skipped", reason: "player_not_found" },
        { jobId: "4", status: "??" },
      ],
    });
    expect(autoReviewLabel(a.get("1"))?.text).toBe("AI review ready");
    expect(autoReviewLabel(a.get("2"))?.text).toBe("Not enough credits");
    expect(autoReviewLabel(a.get("3"))?.text).toBe("You're not in this demo");
    expect(a.has("4")).toBe(false);
    expect(normalizeOwnership(null).size).toBe(0);
  });
  it("filters by owner tab, map and period with counts", () => {
    const list = [m("1", 1), m("2", 3), m("3", 20), m("4", 40)];
    const owners = normalizeOwnership({
      items: [
        { jobId: "2", ownership: "external" },
        { jobId: "4", ownership: "mine" },
      ],
    });
    const sums = new Map([
      ["a1", { map: "de_mirage" }],
      ["a2", { map: "de_mirage" }],
      ["a3", { map: "de_nuke" }],
    ]);
    const all = filterMatches(
      list,
      owners,
      sums,
      { tab: "all", map: null, period: "all" },
      NOW,
    );
    expect(all.counts).toEqual({ all: 4, mine: 3, external: 1 });
    const ext = filterMatches(
      list,
      owners,
      sums,
      { tab: "external", map: null, period: "all" },
      NOW,
    );
    expect(ext.list.map((x) => x.id)).toEqual(["2"]);
    const mirage30 = filterMatches(
      list,
      owners,
      sums,
      { tab: "mine", map: "de_mirage", period: "30d" },
      NOW,
    );
    expect(mirage30.list.map((x) => x.id)).toEqual(["1"]);
    expect(mirage30.counts).toEqual({ all: 2, mine: 1, external: 1 });
    const week = filterMatches(
      list,
      owners,
      sums,
      { tab: "all", map: null, period: "7d" },
      NOW,
    );
    expect(week.list.map((x) => x.id)).toEqual(["1", "2"]);
  });
  it("puts my matches first", () => {
    const owners = normalizeOwnership({
      items: [{ jobId: "1", ownership: "external" }],
    });
    expect(
      mineFirst([m("1", 0), m("2", 5), m("3", 1)], owners).map((x) => x.id),
    ).toEqual(["3", "2", "1"]);
  });
});
