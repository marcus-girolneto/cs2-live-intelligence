import { describe, expect, it } from "vitest";
import { ADMIN, isActive, NAV_GROUPS, SETTINGS } from "./links";

describe("navigation", () => {
  it("lists every section once", () => {
    const hrefs = [...NAV_GROUPS.flatMap((g) => g.links), SETTINGS, ADMIN].map(
      (l) => l.href,
    );
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs).toEqual(
      expect.arrayContaining([
        "/",
        "/coach",
        "/history",
        "/progress",
        "/upload",
        "/live",
      ]),
    );
  });
  it("matches the active section", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/coach", "/")).toBe(false);
    expect(isActive("/admin/users", "/admin")).toBe(true);
    expect(isActive("/demo", "/history")).toBe(true);
    expect(isActive("/historyx", "/history")).toBe(false);
  });
  it("keeps Personal Coach apart from the AI Coach entry", () => {
    expect(isActive("/coach/personal", "/coach")).toBe(false);
    expect(isActive("/coach/personal", "/coach/personal")).toBe(true);
    expect(isActive("/coach", "/coach")).toBe(true);
  });
});
