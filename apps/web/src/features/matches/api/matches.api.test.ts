import { describe, expect, it } from "vitest";
import type { UploadOptions, Uploader } from "@/shared/http";
import { FakeHttpClient } from "@/shared/http/FakeHttpClient";
import { createMatchesApi } from "./matches.api";

describe("MatchesApi", () => {
  it("uploads the raw demo through the progress uploader", async () => {
    const calls: { path: string; body: Blob; options?: UploadOptions }[] = [];
    const uploader: Uploader = {
      upload: async <T>(path: string, body: Blob, options?: UploadOptions) => {
        calls.push({ path, body, options });
        options?.onProgress?.({ loaded: 1, total: 1 });
        return { id: "j1" } as T;
      },
    };
    const file = new File(["x"], "match.dem");
    const progress: number[] = [];
    const ctrl = new AbortController();
    await expect(
      createMatchesApi(new FakeHttpClient(), uploader).uploadDemo(file, {
        signal: ctrl.signal,
        onProgress: (p) => progress.push(p.loaded),
      }),
    ).resolves.toEqual({ id: "j1" });
    expect(calls[0]).toMatchObject({ path: "demos/uploads", body: file });
    expect(calls[0]!.options).toMatchObject({
      headers: { "x-filename": "match.dem" },
      signal: ctrl.signal,
    });
    expect(progress).toEqual([1]);
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
