import { describe, expect, it } from "vitest";
import { clipText } from "./clip-text.js";

describe("clipText", () => {
  it("keeps short text", () => {
    expect(clipText("Trade your entry.", 90)).toBe("Trade your entry.");
  });
  it("never cuts a word", () => {
    const out = clipText(
      "Strong openings, but you die alone at Middle. Keep a trade partner within reach",
      60,
    );
    expect(out).toBe("Strong openings, but you die alone at Middle.");
  });
  it("ends on a space with an ellipsis when no sentence fits", () => {
    const out = clipText(
      "Você abre bem os rounds mas morre isolado quase sempre sem nenhum companheiro por perto",
      40,
    );
    expect(out.length).toBeLessThanOrEqual(40);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toMatch(/\s…$/);
    expect("Você abre bem os rounds mas morre isolado").toContain(
      out.slice(0, -1),
    );
  });
});
