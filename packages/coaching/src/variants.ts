/**
 * Prompt A/B: each review purpose has the base prompt ("a") and one alternative ("b") defined
 * here in code (so the prompt-integrity pins and canaries still apply). Users are split by a
 * stable hash of their id; the admin sets the share of traffic that gets "b".
 */
import { createHash } from "node:crypto";
import { canaryFor, canaryLine } from "./security.js";

export type PromptVariant = "a" | "b";

export const VARIANT_B_ADDENDUM = `

VARIANT B (this request uses the focused style; it refines the output rules above):
- Lead with the single habit that cost the most rounds: it is the first improvement item and the first plan item.
- Give fewer, sharper items: at most 4 insights or patterns in total.
- Every recommendation starts with a verb and says WHEN it applies (side, situation such as 4v5, or callout).`;

/** Version string of a variant ("b" adds the "-b" suffix). */
export const variantVersion = (base: string, variant: PromptVariant): string =>
  variant === "b" ? `${base}-b` : base;

/** The system prompt of a variant: "b" swaps the canary and appends the addendum. */
export function variantPrompt(
  base: string,
  baseVersion: string,
  variant: PromptVariant,
): string {
  if (variant === "a") return base;
  const line = canaryLine(baseVersion);
  const body = base.includes(line)
    ? base.replace(line, "")
    : base.replace(canaryFor(baseVersion), "");
  return (
    body + VARIANT_B_ADDENDUM + canaryLine(variantVersion(baseVersion, "b"))
  );
}

/** Stable 0-99 bucket of a user for a purpose. */
export function abBucket(userKey: string, purpose: string): number {
  const h = createHash("sha256").update(`ab:${purpose}:${userKey}`).digest();
  return h.readUInt32BE(0) % 100;
}
/** "b" for the first `bPercent` buckets (0 = never, 100 = always). */
export function variantFor(
  userKey: string,
  purpose: string,
  bPercent: number,
): PromptVariant {
  return abBucket(userKey, purpose) < Math.max(0, Math.min(100, bPercent))
    ? "b"
    : "a";
}
