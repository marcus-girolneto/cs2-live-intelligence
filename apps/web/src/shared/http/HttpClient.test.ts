import { describe, expect, it, vi } from "vitest";
import { ApiError } from "./ApiError";
import { FetchHttpClient, withQuery } from "./HttpClient";

const reply = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status });

describe("FetchHttpClient", () => {
  it("prefixes the base path, sends JSON and never caches", async () => {
    const fetchImpl = vi.fn(async () => reply(200, { ok: true }));
    const http = new FetchHttpClient({ basePath: "/api/platform", fetchImpl });
    await expect(http.put("settings", { a: 1 })).resolves.toEqual({ ok: true });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("/api/platform/settings");
    expect(init.method).toBe("PUT");
    expect(init.cache).toBe("no-store");
    expect(init.body).toBe('{"a":1}');
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
  it("returns undefined on 204 and keeps the caller's signal", async () => {
    const fetchImpl = vi.fn(async () => reply(204));
    const http = new FetchHttpClient({ basePath: "/api", fetchImpl });
    const signal = new AbortController().signal;
    await expect(http.delete("x", { signal })).resolves.toBeUndefined();
    expect(
      (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].signal,
    ).toBe(signal);
  });
  it("throws ApiError with status, code, missing and body", async () => {
    const body = {
      error: "Daily limit reached",
      code: "plan_limit",
      missing: ["x"],
    };
    const http = new FetchHttpClient({
      basePath: "/api/platform",
      fetchImpl: async () => reply(402, body),
    });
    const error = (await http.get("me").catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe("Daily limit reached");
    expect(error.status).toBe(402);
    expect(error.code).toBe("plan_limit");
    expect(error.missing).toEqual(["x"]);
    expect(error.body).toEqual(body);
    expect(error.serverMessage).toBe("Daily limit reached");
  });
  it("falls back to a generic message when the body has none", async () => {
    const http = new FetchHttpClient({
      basePath: "/api",
      fetchImpl: async () => new Response("not json", { status: 500 }),
    });
    const error = (await http.get("x").catch((e: unknown) => e)) as ApiError;
    expect(error.message).toBe("Request failed (500).");
    expect(error.serverMessage).toBeUndefined();
  });
  it("encodes query parameters and skips undefined ones", () => {
    expect(withQuery("a", { round: 3, from: "1.5", to: undefined })).toBe(
      "a?round=3&from=1.5",
    );
    expect(withQuery("a?x=1", { y: 2 })).toBe("a?x=1&y=2");
    expect(withQuery("a")).toBe("a");
  });
});
