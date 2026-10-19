import { afterEach, describe, expect, it, vi } from "vitest";
import { sameOrigin } from "./origin";
afterEach(() => vi.unstubAllEnvs());
describe("same-origin browser requests", () => {
  it("accepts configured public origin when Next listener URL uses localhost", () => {
    vi.stubEnv("WEB_ORIGIN", "http://127.0.0.1:3100");
    const request = new Request("http://localhost:3100/api/login", {
      headers: { Origin: "http://127.0.0.1:3100", Host: "127.0.0.1:3100" },
    });
    expect(sameOrigin(request)).toBe(true);
  });
  it("rejects malicious origins even with a configured public origin", () => {
    vi.stubEnv("WEB_ORIGIN", "http://127.0.0.1:3100");
    for (const origin of [
      "https://evil.example",
      "http://127.0.0.1:3100.evil.example",
      "null",
    ]) {
      expect(
        sameOrigin(
          new Request("http://localhost:3100/api/login", {
            headers: { Origin: origin },
          }),
        ),
      ).toBe(false);
    }
  });
  it("uses Host with request protocol when no public origin is configured", () => {
    vi.stubEnv("WEB_ORIGIN", "");
    expect(
      sameOrigin(
        new Request("http://localhost:3100/api/login", {
          headers: { Origin: "http://127.0.0.1:3100", Host: "127.0.0.1:3100" },
        }),
      ),
    ).toBe(true);
    expect(
      sameOrigin(
        new Request("http://localhost:3100/api/login", {
          headers: { Origin: "https://127.0.0.1:3100", Host: "127.0.0.1:3100" },
        }),
      ),
    ).toBe(false);
  });
});
