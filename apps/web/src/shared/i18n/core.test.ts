import { describe, expect, it } from "vitest";
import { interpolate } from "./core";

describe("interpolate", () => {
  it("fills placeholders", () => {
    expect(interpolate("{a} and {b}", { a: 1, b: "x" })).toBe("1 and x");
  });
  it("picks ICU plural forms per locale", () => {
    const en = "{n, plural, one {# enemy} other {# enemies}} blinded";
    expect(interpolate(en, { n: 1 })).toBe("1 enemy blinded");
    expect(interpolate(en, { n: 3 })).toBe("3 enemies blinded");
    const ru =
      "{n, plural, one {# враг} few {# врага} many {# врагов} other {# врага}}";
    expect(interpolate(ru, { n: 1 }, "ru")).toBe("1 враг");
    expect(interpolate(ru, { n: 3 }, "ru")).toBe("3 врага");
    expect(interpolate(ru, { n: 5 }, "ru")).toBe("5 врагов");
    expect(
      interpolate("{n, plural, =0 {none} other {# x}} at {p}", {
        n: 0,
        p: "A",
      }),
    ).toBe("none at A");
  });
});
