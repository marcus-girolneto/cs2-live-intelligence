import {
  aiCoaching,
  aiLiveCall,
  callModel,
  generateCoaching,
  type AiCoachingResult,
  type AiConfig,
  type LiveCall,
  type LiveCoachInput,
  aiMonthlyReport,
  type DeepResult,
  type ModelResult,
  type Personalization,
} from "@cs2/coaching";
import type { Analysis, Coaching, MonthlyReport } from "@cs2/contracts";

export type CoachLanguage = "en" | "pt";
export type ModelMeta = Omit<ModelResult, "data">;
export interface ConnectivityResult {
  ok: true;
  provider: string;
  model: string;
  latencyMs: number;
  reply: string;
  usage?: ModelResult["usage"];
}

export type ReviewOptions = {
  focusSteamId: string;
  lang: CoachLanguage;
  personal: Personalization;
  /** Review tier (default quick); deep needs the precomputed deep modules. */
  tier?: "quick" | "deep";
  deep?: DeepResult;
};

/**
 * Port: everything the API asks of a language model. The provider wire format (chat vs
 * responses API, JSON mode, retries) is a Strategy selected inside @cs2/coaching from the
 * AiConfig; this port only hides that library from the services.
 */
export interface AiGateway {
  review(
    analysis: Analysis,
    config: AiConfig,
    options: ReviewOptions,
  ): Promise<AiCoachingResult>;
  liveCall(
    input: LiveCoachInput,
    config: AiConfig,
    options: { lang: CoachLanguage; personal: Personalization },
  ): Promise<{ call: LiveCall; meta: ModelMeta }>;
  /** One tiny structured call confirming the provider + model answers. */
  connectivityCheck(config: AiConfig): Promise<ConnectivityResult>;
  /** Narrative of a deterministic monthly report (purpose "report"). */
  monthlyReport(
    report: MonthlyReport,
    config: AiConfig,
    lang: CoachLanguage,
  ): Promise<{ report: MonthlyReport; call: ModelMeta }>;
}

/** Port: deterministic (model-free) coaching attached to every processed upload. */
export interface OfflineCoach {
  coach(analysis: Analysis): Promise<Coaching>;
}

/** Adapter over @cs2/coaching. */
export class CoachingAiGateway implements AiGateway, OfflineCoach {
  review(
    analysis: Analysis,
    config: AiConfig,
    options: ReviewOptions,
  ): Promise<AiCoachingResult> {
    return aiCoaching(analysis, config, options);
  }
  liveCall(
    input: LiveCoachInput,
    config: AiConfig,
    options: { lang: CoachLanguage; personal: Personalization },
  ): Promise<{ call: LiveCall; meta: ModelMeta }> {
    return aiLiveCall(input, config, options);
  }
  coach(analysis: Analysis): Promise<Coaching> {
    // Uploads never spend model tokens; AI reviews are requested explicitly per player.
    return generateCoaching(analysis);
  }
  monthlyReport(
    report: MonthlyReport,
    config: AiConfig,
    lang: CoachLanguage,
  ): Promise<{ report: MonthlyReport; call: ModelMeta }> {
    return aiMonthlyReport(report, config, lang);
  }
  async connectivityCheck(config: AiConfig): Promise<ConnectivityResult> {
    const result = await callModel(config, {
      system:
        "You are a connectivity check. Reply with the JSON object requested.",
      user: 'Return {"ok": true, "reply": "<one short sentence confirming you are working>"}.',
      schemaName: "connectivity_check",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["ok", "reply"],
        properties: { ok: { type: "boolean" }, reply: { type: "string" } },
      },
    });
    const data = result.data as { reply?: unknown };
    return {
      ok: true,
      provider: result.provider,
      model: result.model,
      latencyMs: result.latencyMs,
      reply: typeof data?.reply === "string" ? data.reply.slice(0, 300) : "",
      ...(result.usage ? { usage: result.usage } : {}),
    };
  }
}
