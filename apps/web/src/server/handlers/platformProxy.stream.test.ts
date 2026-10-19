import { afterEach, describe, expect, it, vi } from "vitest";
// A tiny cap so the streaming limit can be exercised without 500 MB of data.
vi.mock("@/shared/config/limits", () => ({
  MAX_DEMO_BYTES: 8,
  MAX_DEMO_MB: 0,
}));
vi.mock("../session", () => ({
  apiUrl: () => "http://api:4000",
  ownerToken: async () => "server-owner-token",
  sameOrigin: () => true,
  json: (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
}));
import { POST } from "./platformProxy";

const context = { params: Promise.resolve({ path: ["demos", "uploads"] }) };
const upload = (body: BodyInit, headers: Record<string, string> = {}) =>
  new Request("http://web/api/platform/demos/uploads", {
    method: "POST",
    headers: { "x-filename": "big.dem", ...headers },
    body,
    // @ts-expect-error -- Node's fetch needs duplex for stream bodies.
    duplex: "half",
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("demo upload streaming cap", () => {
  it("answers 413 when the streamed demo passes the cap mid-upload", async () => {
    // The fake API consumes the body like a real upstream would.
    const upstream = vi.fn(async (_url: string, init: RequestInit) => {
      await new Response(init.body).arrayBuffer();
      return new Response("{}", { status: 202 });
    });
    vi.stubGlobal("fetch", upstream);
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new Uint8Array(6));
        c.enqueue(new Uint8Array(6));
        c.close();
      },
    });
    const res = await POST(upload(stream), context);
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({
      error: "Demo exceeds the 500 MB upload limit.",
    });
  });
  it("rejects a declared oversized demo without contacting the API", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const res = await POST(
      upload(new Uint8Array(4), { "Content-Length": "9" }),
      context,
    );
    expect(res.status).toBe(413);
    expect(upstream).not.toHaveBeenCalled();
  });
  it("streams a demo under the cap", async () => {
    let received = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        received = (await new Response(init.body).arrayBuffer()).byteLength;
        return new Response(JSON.stringify({ id: "j" }), { status: 202 });
      }),
    );
    const res = await POST(upload(new Uint8Array(8)), context);
    expect(res.status).toBe(202);
    expect(received).toBe(8);
  });
});
