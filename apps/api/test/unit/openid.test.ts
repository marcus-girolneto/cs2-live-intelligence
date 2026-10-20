import { describe, expect, it } from "vitest";
import {
  assertionRejectionReason,
  steamCallbackUrl,
} from "../../src/modules/auth/openid.js";

const API = "http://127.0.0.1:4000";
const now = Date.parse("2026-10-20T00:20:00Z");
const base = (state: string) => ({
  state,
  "openid.mode": "id_res",
  "openid.return_to": steamCallbackUrl(API, state),
  "openid.response_nonce": "2026-10-20T00:19:58Zabc",
});

describe("assertionRejectionReason", () => {
  it("names the first failing check without echoing values", () => {
    expect(assertionRejectionReason(base("s1"), undefined, API, now)).toBe(
      "state_cookie_missing",
    );
    expect(assertionRejectionReason(base("s1"), "s2", API, now)).toBe(
      "state_mismatch",
    );
    expect(
      assertionRejectionReason(
        { ...base("s1"), "openid.return_to": "http://evil.example/cb" },
        "s1",
        API,
        now,
      ),
    ).toBe("return_to_mismatch");
    expect(
      assertionRejectionReason(base("s1"), "s1", API, now + 3_600_000),
    ).toBe("nonce_time");
  });
});
