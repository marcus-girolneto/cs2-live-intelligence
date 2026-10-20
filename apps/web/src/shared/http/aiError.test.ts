import { describe, expect, it } from "vitest";
import { ApiError } from "./ApiError";
import { aiErrorText } from "./aiError";

describe("AI error text", () => {
  it("never shows provider or configuration details", () => {
    const cut = new ApiError(
      "The model response was cut off; raise AI_MAX_OUTPUT_TOKENS.",
      502,
      "ai_truncated",
    );
    expect(aiErrorText(cut, "personal")).toBe(
      "The coach couldn't finish your plan. Try again in a moment.",
    );
    expect(aiErrorText(cut, "team")).not.toMatch(/AI_|token|model/i);
    expect(
      aiErrorText(new ApiError("upstream 500 from vendor", 502), "report"),
    ).toBe("The coach couldn't finish your report. Try again in a moment.");
    expect(aiErrorText(new ApiError("x", 504, "ai_timeout"), "review")).toMatch(
      /too long/,
    );
  });
  it("keeps user-facing client errors", () => {
    expect(
      aiErrorText(new ApiError("Player not found", 404, "not_found"), "review"),
    ).toBe("Player not found");
  });
});
