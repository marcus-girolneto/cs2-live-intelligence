import { PassThrough, Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { describe, expect, it } from "vitest";
import {
  DemoRejectedError,
  demoSniffer,
  inspectDemoHeader,
  MIN_DEMO_BYTES,
} from "../../src/modules/matches/demo-signature.js";
import {
  networkOf,
  UploadRateLimiter,
} from "../../src/modules/matches/upload-rate-limit.js";
import { demoBytes } from "../support/demo-bytes.js";
import { appError } from "./fakes.js";

async function sniff(chunks: Buffer[]): Promise<string | undefined> {
  try {
    await pipeline(
      Readable.from(chunks),
      demoSniffer(),
      new PassThrough().resume(),
    );
    return undefined;
  } catch (error) {
    return error instanceof DemoRejectedError ? error.reason : String(error);
  }
}

describe("demo header validation", () => {
  const valid = demoBytes("x");
  it("accepts a CS2 header and the real fixture's first bytes", () => {
    expect(inspectDemoHeader(valid.subarray(0, 64), false)).toBeUndefined();
    // First 32 bytes of the pinned public fixture (apps/demo-parser/testdata).
    const fixture = Buffer.from(
      "504244454d5332001ab69c0315b69c0301ffffffff0fc9010a08504244454d533200",
      "hex",
    );
    expect(
      inspectDemoHeader(Buffer.concat([fixture, Buffer.alloc(64)]), false),
    ).toBeUndefined();
  });
  it("rejects wrong magic, wrong first command, absurd frame sizes", () => {
    expect(
      inspectDemoHeader(Buffer.from("HL2DEMO\0" + "x".repeat(60)), false),
    ).toBe("not_cs2_demo");
    const wrongCommand = Buffer.from(valid);
    wrongCommand[16] = 7;
    expect(inspectDemoHeader(wrongCommand.subarray(0, 64), false)).toBe(
      "not_cs2_demo",
    );
    const hugeFrame = Buffer.from(valid);
    hugeFrame.set([0xff, 0xff, 0xff, 0x7f], 22);
    expect(inspectDemoHeader(hugeFrame.subarray(0, 64), false)).toBe(
      "not_cs2_demo",
    );
  });
  it("streams: fails fast on the first chunk, enforces the minimum size at the end", async () => {
    expect(await sniff([Buffer.from("MZ\x90\0" + "x".repeat(100))])).toBe(
      "not_cs2_demo",
    );
    expect(
      await sniff([valid.subarray(0, 3), valid.subarray(3)]),
    ).toBeUndefined();
    expect(await sniff([valid.subarray(0, 1000)])).toBe("too_small");
    expect(await sniff([valid.subarray(0, 20)])).toBe("too_small");
    expect(await sniff([Buffer.from("PBD")])).toBe("not_cs2_demo");
    expect(await sniff([])).toBeUndefined();
    expect(MIN_DEMO_BYTES).toBe(65536);
  });
});

describe("upload rate limits", () => {
  it("groups addresses by /24 and /48", () => {
    expect(networkOf("203.0.113.77")).toBe("203.0.113.0/24");
    expect(networkOf("::ffff:203.0.113.9")).toBe("203.0.113.0/24");
    expect(networkOf("2001:db8:abcd:12::1")).toBe("2001:db8:abcd::/48");
    expect(networkOf("2001:db8::1")).toBe("2001:db8:0::/48");
    expect(networkOf("::1")).toBe("0:0:0::/48");
  });
  it("limits 10/min per account and 30/min per network with Retry-After", async () => {
    let now = 0;
    const limiter = new UploadRateLimiter(() => now);
    for (let i = 0; i < 10; i++) limiter.check("a", "198.51.100.1");
    now = 15_000;
    const error = await appError(
      Promise.resolve().then(() => limiter.check("a", "198.51.100.1")),
    );
    expect(error.status).toBe(429);
    expect(error.body).toMatchObject({
      code: "upload_rate_limited",
      retryAfterSeconds: 45,
    });
    expect(error.headers).toEqual({ "retry-after": "45" });
    // Other accounts on the same /24 share 30 attempts per minute (10 already used).
    for (let i = 0; i < 20; i++) limiter.check(`u${i}`, `198.51.100.${i + 2}`);
    expect(
      (
        await appError(
          Promise.resolve().then(() => limiter.check("z", "198.51.100.200")),
        )
      ).status,
    ).toBe(429);
    limiter.check("z", "<IP_ADDRESS>");
    now = 61_000;
    limiter.check("a", "198.51.100.1");
  });
});
