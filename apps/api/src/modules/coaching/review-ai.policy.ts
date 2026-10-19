import { variantFor, type AiConfig, type PromptVariant } from "@cs2/coaching";
import type { AiPurpose, AppSettings } from "../ai-config/ai-config.dto.js";
import type { ResolvedAi } from "../ai-config/ai-settings.service.js";

export type ReviewPurpose = "review_quick" | "review_deep" | "review_team";

/** Port (ai-config): the admin settings and resolved configs. */
export interface AiSettingsSource {
  settings(): Promise<AppSettings>;
  resolve(purpose: AiPurpose): Promise<ResolvedAi>;
}

/** What review services need to know beyond the main model: verifier and A/B variant. */
export interface ReviewAi {
  /** The verifier's model config, or undefined when disabled or not configured. */
  verifierConfig(): Promise<AiConfig | undefined>;
  /** The user's prompt variant for a purpose (admin traffic share of "b"). */
  variant(ownerId: string, purpose: ReviewPurpose): Promise<PromptVariant>;
}

/**
 * Reads `verifierEnabled` and `promptAb` from the admin app settings. The verifier call does
 * not consume the user's daily AI request cap (it is part of the review it checks).
 */
export class SettingsReviewAi implements ReviewAi {
  constructor(private readonly ai: AiSettingsSource) {}

  async verifierConfig(): Promise<AiConfig | undefined> {
    if (!(await this.ai.settings()).verifierEnabled) return undefined;
    const resolved = await this.ai.resolve("verify");
    return resolved.result.ok ? resolved.result.config : undefined;
  }

  async variant(
    ownerId: string,
    purpose: ReviewPurpose,
  ): Promise<PromptVariant> {
    const share = (await this.ai.settings()).promptAb?.[purpose] ?? 0;
    return variantFor(ownerId, purpose, share);
  }
}

/** Fixed policy for tests and tooling (no verifier model, always variant "a"). */
export const NO_REVIEW_AI: ReviewAi = {
  verifierConfig: async () => undefined,
  variant: async () => "a",
};
