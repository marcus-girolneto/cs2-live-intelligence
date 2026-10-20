import { describe, expect, it } from "vitest";
import { mentionsDegrees, stripDegrees } from "./degrees.js";

describe("degrees in model text", () => {
  it("drops sentences that mention angles, in every language", () => {
    expect(
      stripDegrees(
        "Sua mira ficou baixa. O desvio mediano foi de 5,5° no início do duelo. Suba a mira.",
      ),
    ).toBe("Sua mira ficou baixa. Suba a mira.");
    for (const s of [
      "3 degrees off",
      "4 graus",
      "2 grados",
      "на 3 градуса",
      "偏离5度",
      "um 4 Grad",
      "de 3 degrés",
      "o 5 stopni",
      "5 derece",
    ])
      expect(mentionsDegrees(s), s).toBe(true);
    expect(mentionsDegrees("速度很快，程度不同")).toBe(false);
    expect(mentionsDegrees("Round 5: 2 kills")).toBe(false);
  });
  it("cuts only the angle when it is the whole text", () => {
    expect(stripDegrees("Crosshair too low (3.2°)")).toBe("Crosshair too low");
  });
});
