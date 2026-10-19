import { describe, expect, it } from "vitest";
import { FakeHttpClient } from "@/shared/http/FakeHttpClient";
import { createLiveApi } from "./live.api";

const req = { state: null, rounds: [], baseline: null, lang: "en" };

describe("live api", () => {
  it("rejects a half-formed IGL call instead of rendering it", async () => {
    const http = new FakeHttpClient().on("POST", "ai/live-call", { ok: true });
    await expect(createLiveApi(http).liveCall(req)).rejects.toThrow(
      "The coach returned an unexpected answer.",
    );
  });
  it("fills missing optional fields of a valid call", async () => {
    const http = new FakeHttpClient().on("POST", "ai/live-call", {
      id: "c1",
      call: { call: "Buy armor" },
    });
    const r = await createLiveApi(http).liveCall(req);
    expect(r.call).toEqual({
      call: "Buy armor",
      why: "",
      focus: "general",
      confidence: "medium",
    });
  });
});
