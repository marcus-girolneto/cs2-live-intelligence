import { describe, expect, it } from "vitest";
import { FakeHttpClient } from "@/shared/http/FakeHttpClient";
import { createReplayApi } from "./replay.api";

describe("ReplayApi", () => {
  it("requests a clip window with a rounded query", async () => {
    const http = new FakeHttpClient().on("GET", "analyses/a%2F1/replay", null);
    await expect(
      createReplayApi(http).getWindow("a/1", {
        round: 3,
        from: 1.04,
        to: 9.96,
      }),
    ).rejects.toThrow("This clip has no positions to replay.");
    expect(http.calls[0]!.options.query).toEqual({
      round: "3",
      from: "1",
      to: "10",
    });
  });
  it("rejects a match without replay meta", async () => {
    const http = new FakeHttpClient().on("GET", "analyses/a/replay/meta", {});
    await expect(createReplayApi(http).getMeta("a")).rejects.toThrow(
      "This match has no replay data.",
    );
  });
});
