import { describe, expect, it } from "vitest";
import { calloutName, isRawCallout, prettifyCallouts } from "./callouts.js";

describe("callouts", () => {
  it("reads like people say them", () => {
    expect(calloutName("TopofMid")).toBe("Top of Mid");
    expect(calloutName("SnipersNest")).toBe("Sniper's Nest");
    expect(calloutName("BombsiteA")).toBe("Bombsite A");
    expect(calloutName("CTSpawn")).toBe("CT Spawn");
    expect(calloutName("LongA")).toBe("Long A");
    expect(calloutName("Catwalk")).toBe("Catwalk");
    expect(calloutName("Top of Mid")).toBe("Top of Mid");
  });
  it("prettifies raw callouts in text, whole words only", () => {
    expect(
      prettifyCallouts(
        "Você morreu no TopofMid e no CTSpawn, perto de SnipersNest.",
      ),
    ).toBe("Você morreu no Top of Mid e no CT Spawn, perto de Sniper's Nest.");
    expect(prettifyCallouts("O AWPer e os IGLs jogam AK-47 no MP9.")).toBe(
      "O AWPer e os IGLs jogam AK-47 no MP9.",
    );
    expect(isRawCallout("Catwalk")).toBe(false);
  });
});
