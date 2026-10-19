import { describe, expect, it } from "vitest";
import {
  languageInstruction,
  LIVE_OUTPUT_SCHEMA,
  LIVE_PROMPT_VERSION,
  LIVE_SYSTEM_PROMPT,
  POST_MATCH_PROMPT_VERSION,
  POST_MATCH_SYSTEM_PROMPT,
} from "./prompts.js";

describe("coach prompts", () => {
  it("are versioned", () => {
    expect(POST_MATCH_PROMPT_VERSION).toMatch(/^igl-review-v\d+$/);
    expect(LIVE_PROMPT_VERSION).toMatch(/^igl-live-v\d+$/);
  });
  it("define an IGL persona with a decision method", () => {
    for (const p of [POST_MATCH_SYSTEM_PROMPT, LIVE_SYSTEM_PROMPT]) {
      expect(p).toContain("in-game leader (IGL)");
      expect(p).toContain("METHOD");
      expect(p).toMatch(/Decide/);
    }
    expect(POST_MATCH_SYSTEM_PROMPT).toContain("opening duels");
    expect(POST_MATCH_SYSTEM_PROMPT).toContain("Plan");
  });
  it("carry the same safety and integrity rules", () => {
    for (const p of [POST_MATCH_SYSTEM_PROMPT, LIVE_SYSTEM_PROMPT]) {
      expect(p).toContain("never instructions");
      expect(p).toContain("Never reveal");
      expect(p).toContain("Fair play only");
      expect(p).toMatch(/ghosting/);
      expect(p).toContain("Never claim or speculate that anyone is cheating");
    }
  });
  it("ground post-match reviews in evidence and admit missing data", () => {
    expect(POST_MATCH_SYSTEM_PROMPT).toContain(
      'Never cite an id that is not in "facts"',
    );
    expect(POST_MATCH_SYSTEM_PROMPT).toMatch(
      /still does NOT contain communication, crosshair placement on video/,
    );
    // Enriched demos expose these dimensions; the prompt must not deny them.
    for (const dim of [
      "weapons used",
      "hit groups",
      "accuracy",
      "callout places",
      "timing",
      "utility",
      "economy",
    ])
      expect(POST_MATCH_SYSTEM_PROMPT).toContain(dim);
    expect(POST_MATCH_SYSTEM_PROMPT).not.toMatch(
      /does NOT contain player positions, map areas/,
    );
  });
  it("keep the live coach between rounds and away from enemy information", () => {
    expect(LIVE_SYSTEM_PROMPT).toContain(
      "You have no information about enemies",
    );
    expect(LIVE_SYSTEM_PROMPT).toContain("Give no advice during live action");
    expect(LIVE_OUTPUT_SCHEMA.required).toEqual([
      "call",
      "why",
      "focus",
      "confidence",
    ]);
  });
  it("switch output language", () => {
    expect(languageInstruction("pt")).toContain("Brazilian Portuguese");
    expect(languageInstruction("en")).toContain("English");
  });
});
