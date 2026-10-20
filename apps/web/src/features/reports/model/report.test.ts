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
  it("normalizes a ReportDto (summary at the top, MonthlyReport under report)", () => {
    const trend = (key: string, values: number[], better = "higher") => ({
      key,
      label: key.toUpperCase(),
      unit: "",
      better,
      value: values.at(-1),
      previous: null,
      series: values.map((value, i) => ({
        analysisId: `a${i}`,
        date: `2026-10-0${i + 1}T12:00:00Z`,
        value,
      })),
    });
    const r = normalizeReport({
      id: "r1",
      period: "2026-10",
      source: "on_demand",
      createdAt: "2026-10-19T00:00:00Z",
      matches: 12,
      headline: "List headline",
      report: {
        schemaVersion: "1.0",
        period: "2026-10",
        matches: 12,
        rounds: 260,
        trends: [trend("adr", [70, 80]), trend("kast", [1])],
        maps: [
          {
            map: "de_mirage",
            matches: 4,
            winRate: 75,
            adr: 80,
            kd: 1.1,
            topDeathPlaces: [],
          },
          { matches: 2 },
        ],
        recurringMistakes: [
          {
            key: "first",
            label: "dies first",
            matches: 4,
            detail: "Stop dry peeks.",
          },
        ],
        utilityCrosshair: [
          trend("medianOffset", [6, 5], "lower"),
          trend("flashEfficiency", [30, 40]),
        ],
        best: {
          analysisId: "a1",
          filename: "x.dem",
          date: "2026-10-02",
          map: "de_nuke",
          adr: 99,
          kills: 25,
          deaths: 10,
          won: true,
        },
        worst: null,
        narrative: {
          headline: "Big month",
          summary: "First paragraph.\n\nSecond one.",
          strengths: ["aim"],
          focus: ["trades"],
          plan: ["one", "two"],
        },
        caveats: ["Only 2 deep reviews."],
      },
    })!;
    expect(r.summary).toMatchObject({
      matches: 12,
      rounds: 260,
      adr: 80,
      headline: "Big month",
    });
    expect(r.trends.map((s) => s.key)).toEqual(["adr"]);
    expect(r.trends[0]!.points[0]!.label).toBe("10/01");
    expect(r.perMap).toHaveLength(1);
    expect(r.recurring[0]).toMatchObject({
      title: "dies first",
      count: 4,
      tip: "Stop dry peeks.",
    });
    expect(r.crosshair!.series.map((s) => s.key)).toEqual(["medianOffset"]);
    expect(r.utility!.series.map((s) => s.key)).toEqual(["flashEfficiency"]);
    expect(seriesDelta(r.crosshair!.series[0]!).good).toBe(true);
    expect(r.bestMatch).toMatchObject({
      analysisId: "a1",
      headline: "Win · x.dem",
    });
    expect(r.worstMatch).toBeNull();
    expect(r.plan).toEqual(["one", "two"]);
    expect(r.narrative).toEqual(["First paragraph.", "Second one."]);
    expect(r.strengths).toEqual(["aim"]);
    expect(r.caveats).toHaveLength(1);
  });
  it("rejects reports without id and sorts the list newest first", () => {
    expect(normalizeReport({ period: "2026-10" })).toBeNull();
    expect(
      normalizeReportList([{ id: "z", period: "2026-01", matches: 3 }])[0]!
        .summary.matches,
    ).toBe(3);
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
