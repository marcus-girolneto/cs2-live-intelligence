import { describe, expect, it } from "vitest";
import { placeName, weaponClass, weaponName } from "./weapons";
import { flagEmoji, presence, safeImage, yearsSince } from "./steam";

describe("weapon and callout names", () => {
  it("maps engine names to display names and classes", () => {
    expect(weaponName("weapon_ak47")).toBe("AK-47");
    expect(weaponName("m4a1_silencer")).toBe("M4A1-S");
    expect(weaponName("AWP")).toBe("AWP");
    expect(weaponName("Smoke Grenade")).toBe("Smoke");
    expect(weaponName("")).toBeNull();
    expect(weaponClass("AWP")).toBe("sniper");
    expect(weaponClass("knife_karambit")).toBe("knife");
    expect(weaponClass(undefined)).toBe("other");
  });
  it("prettifies callouts", () => {
    expect(placeName("TopofMid")).toBe("Top of Mid");
    expect(placeName("BombsiteA")).toBe("Bombsite A");
    expect(placeName("CTSpawn")).toBe("CT Spawn");
    expect(placeName("TRamp")).toBe("T Ramp");
    expect(placeName(undefined)).toBeNull();
  });
});

describe("steam profile helpers", () => {
  it("formats flags, presence and safe images", () => {
    expect(flagEmoji("br")).toBe("🇧🇷");
    expect(flagEmoji("BRA")).toBeNull();
    expect(presence({ personaName: "a", personaState: "in-game" })).toBe(
      "ingame",
    );
    expect(presence({ personaName: "a", personaState: "offline" })).toBe(
      "offline",
    );
    expect(presence(undefined)).toBe("offline");
    expect(safeImage("javascript:alert(1)")).toBeNull();
    expect(safeImage("https://avatars.steamstatic.com/a.jpg")).toContain(
      "https://",
    );
    expect(yearsSince("2010-10-12T00:00:00Z", Date.parse("2026-10-19"))).toBe(
      16,
    );
    expect(yearsSince("garbage")).toBeNull();
  });
});
