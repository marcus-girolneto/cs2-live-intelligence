import { describe, expect, it } from "vitest";
import { FakeHttpClient } from "@/shared/http/FakeHttpClient";
import { createPersonalApi } from "./personal.api";

describe("createPersonalApi", () => {
  it("reads and generates the personal plan", async () => {
    const http = new FakeHttpClient()
      .on("GET", "coach/personal", {
        latest: { headline: "Trade more" },
        history: [],
      })
      .on("POST", "coach/personal/generate", { headline: "Fresh plan" });
    const api = createPersonalApi(http);
    expect((await api.get()).latest?.headline).toBe("Trade more");
    expect((await api.generate()).latest?.headline).toBe("Fresh plan");
    const post = http.calls.find((c) => c.method === "POST");
    expect(post?.options.timeoutMs).toBeGreaterThan(60_000);
  });
});
