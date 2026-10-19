import { describe, expect, it } from "vitest";
import { FakeHttpClient } from "@/shared/http/FakeHttpClient";
import { createReportsApi } from "../api/reports.api";
import {
  normalizeReport,
  normalizeReportList,
  periodLabel,
  seriesDelta,
} from "./report";
import { SAMPLE_REPORT } from "./sample";

describe("monthly report", () => {
  it("normalizes a full report", () => {
    const r = normalizeReport({
      report: {
        id: "r1",
        period: "2026-10",
        summary: { matches: 12, winRate: 0.5, adr: 81.2 },
        trends: {
          adr: [
            { label: "W1", value: 70 },
            { label: "W2", value: 80 },
          ],
          kast: [{ value: 1 }],
        },
        perMap: [{ map: "de_mirage", matches: 4, winRate: 75 }, { matches: 2 }],
        recurring: [{ pattern: "dies first", count: 4, trend: "worse" }],
        crosshair: {
          series: [
            { key: "medianOffset", points: [{ value: 6 }, { value: 5 }] },
          ],
        },
        bestMatch: { analysisId: "a1", map: "de_nuke", kills: 25 },
        plan: ["one", { text: "two" }, 3],
        narrative: "First paragraph.\n\nSecond one.",
      },
    })!;
    expect(r.summary.winRate).toBe(50);
    expect(r.trends.map((s) => s.key)).toEqual(["adr"]);
    expect(r.perMap).toHaveLength(1);
    expect(r.recurring[0]).toMatchObject({
      title: "dies first",
      trend: "worse",
    });
    expect(r.crosshair!.series[0]!.better).toBe("lower");
    expect(seriesDelta(r.crosshair!.series[0]!).good).toBe(true);
    expect(r.bestMatch!.analysisId).toBe("a1");
    expect(r.worstMatch).toBeNull();
    expect(r.plan).toEqual(["one", "two"]);
    expect(r.narrative).toEqual(["First paragraph.", "Second one."]);
  });
  it("rejects reports without id and sorts the list newest first", () => {
    expect(normalizeReport({ period: "2026-10" })).toBeNull();
    const list = normalizeReportList({
      reports: [
        { id: "a", period: "2026-08" },
        { id: "b", period: "2026-10" },
        {},
      ],
    });
    expect(list.map((x) => x.id)).toEqual(["b", "a"]);
    expect(periodLabel("2026-10", "en-US")).toBe("October 2026");
    expect(periodLabel("Q3", "en-US")).toBe("Q3");
    expect(SAMPLE_REPORT.trends.length).toBeGreaterThan(0);
  });
  it("generates with the AI timeout", async () => {
    const http = new FakeHttpClient().on("POST", "reports/generate", {
      id: "r9",
    });
    const r = await createReportsApi(http).generate();
    expect(r).toEqual({ id: "r9", report: null });
    expect(http.calls[0]!.options.timeoutMs).toBe(600000);
  });
});
