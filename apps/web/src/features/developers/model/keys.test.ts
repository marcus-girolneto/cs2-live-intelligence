import { describe, expect, it } from "vitest";
import {
  activeKeys,
  canCreate,
  looksLikeWebhookUrl,
  sortKeys,
  toggleScope,
} from "./keys";
import type { ApiKey } from "./types";

const key = (
  id: string,
  status: ApiKey["status"],
  createdAt: string,
): ApiKey => ({
  id,
  name: id,
  prefix: "fm_live_ab12",
  scopes: ["matches:read"],
  createdAt,
  lastUsedAt: null,
  expiresAt: null,
  revokedAt: null,
  status,
});

describe("developer keys model", () => {
  it("toggles scopes and keeps the canonical order", () => {
    expect(toggleScope(["analyses:read"], "matches:read")).toEqual([
      "matches:read",
      "analyses:read",
    ]);
    expect(
      toggleScope(["matches:read", "analyses:read"], "matches:read"),
    ).toEqual(["analyses:read"]);
  });
  it("counts and sorts active keys first", () => {
    const keys = [
      key("old", "revoked", "2026-10-01T00:00:00Z"),
      key("a", "active", "2026-10-02T00:00:00Z"),
      key("b", "active", "2026-10-03T00:00:00Z"),
    ];
    expect(activeKeys(keys)).toBe(2);
    expect(sortKeys(keys).map((k) => k.id)).toEqual(["b", "a", "old"]);
  });
  it("validates the create form and webhook URLs", () => {
    expect(canCreate("CI", ["matches:read"])).toBe(true);
    expect(canCreate(" ", ["matches:read"])).toBe(false);
    expect(canCreate("CI", [])).toBe(false);
    expect(looksLikeWebhookUrl("https://example.com/hook")).toBe(true);
    expect(looksLikeWebhookUrl("http://localhost:9000/hook")).toBe(true);
    expect(looksLikeWebhookUrl("http://example.com/hook")).toBe(false);
    expect(looksLikeWebhookUrl("not a url")).toBe(false);
  });
});
