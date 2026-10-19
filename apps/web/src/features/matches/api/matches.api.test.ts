import { describe, expect, it } from "vitest";
import { FakeHttpClient } from "@/shared/http/FakeHttpClient";
import { createMatchesApi } from "./matches.api";

describe("MatchesApi", () => {
  it("uploads the raw demo with its file name and a 2-minute timeout", async () => {
    const http = new FakeHttpClient().on("POST", "demos/uploads", { id: "j1" });
    const file = new File(["x"], "match.dem");
    await expect(createMatchesApi(http).uploadDemo(file)).resolves.toEqual({
      id: "j1",
    });
    expect(http.calls[0]!.options).toMatchObject({
      headers: { "x-filename": "match.dem" },
      body: file,
      timeoutMs: 120000,
    });
  });
  it("encodes match ids and unwraps lists", async () => {
    const http = new FakeHttpClient()
      .on("GET", "matches", { matches: [{ id: "a" }] })
      .on("GET", "matches/a%20b", { id: "a b" });
    const api = createMatchesApi(http);
    await expect(api.listMatches()).resolves.toEqual([{ id: "a" }]);
    await expect(api.getMatch("a b")).resolves.toEqual({ id: "a b" });
  });
  it("reads sample availability and sends feedback", async () => {
    const http = new FakeHttpClient()
      .on("GET", "demos/sample", { available: true })
      .on("POST", "feedback", undefined);
    const api = createMatchesApi(http);
    await expect(api.sampleAvailable()).resolves.toBe(true);
    await api.sendFeedback(4, "ok");
    expect(http.calls[1]!.options.json).toEqual({ rating: 4, comment: "ok" });
  });
});
