import { describe, expect, it } from "vitest";
import { FakeHttpClient } from "@/shared/http/FakeHttpClient";
import planJson from "../model/fixtures/training-plan.json";
import { createTrainingApi } from "./training.api";

describe("createTrainingApi", () => {
  it("reads the catalog, the match plan (steamId query) and recommendations", async () => {
    const http = new FakeHttpClient()
      .on("GET", "training/catalog", { entries: [] })
      .on("GET", "analyses/a%201/training", { training: planJson })
      .on("GET", "training/recommended", {
        steamId: "7",
        latest: { analysisId: "a1", training: planJson },
        focus: ["utility"],
        week: [{ day: 1, rest: true, steps: [] }],
      });
    const api = createTrainingApi(http);
    expect((await api.catalog()).resources).toEqual([]);
    expect((await api.forAnalysis("a 1", "765"))?.map).toBe("de_mirage");
    expect(http.calls[1]!.options.query).toEqual({ steamId: "765" });
    const rec = await api.recommended();
    expect(rec.latest?.analysisId).toBe("a1");
    expect(rec.week[0]!.rest).toBe(true);
  });
});
