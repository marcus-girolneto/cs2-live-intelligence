import { describe, expect, it } from "vitest";
import { AiError } from "@cs2/coaching";
import { aiRequestError } from "../../src/modules/ai-config/ai-errors.js";

describe("AI request errors", () => {
  it("never tell non-admins about budgets or providers, but log the reason", () => {
    const logged: Record<string, unknown>[] = [];
    const cut = new AiError(
      "truncated",
      "The model response was cut off; raise AI_MAX_OUTPUT_TOKENS.",
    );
    const e = aiRequestError(cut, false, {
      info: (fields) => logged.push(fields),
    });
    expect(e.message).toBe(
      "The coach couldn't finish this answer. Try again in a moment.",
    );
    expect(e.message).not.toMatch(/AI_|token/i);
    expect(logged).toEqual([
      {
        code: "truncated",
        reason: "The model response was cut off; raise AI_MAX_OUTPUT_TOKENS.",
      },
    ]);
    expect(aiRequestError(cut, true).message).toMatch(/AI_MAX_OUTPUT_TOKENS/);
  });
});
