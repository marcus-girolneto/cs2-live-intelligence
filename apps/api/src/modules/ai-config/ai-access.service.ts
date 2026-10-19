import type { AiConfig } from "@cs2/coaching";
import type {
  AiGateway,
  ConnectivityResult,
} from "../../infrastructure/ai/coaching-ai-gateway.js";
import {
  ServiceUnavailableError,
  TooManyRequestsError,
} from "../../shared/errors/index.js";
import type { Logger } from "../../shared/logging/logger.js";
import { AI_PURPOSES, type AiPurpose } from "./ai-config.dto.js";
import type { AiUsageRepository } from "./ai-config.repository.js";
import { aiRequestError } from "./ai-errors.js";
import type { AiSettingsService } from "./ai-settings.service.js";

type PurposeStatus = Record<string, unknown> & { configured: boolean };

/**
 * Gate in front of every model call: the purpose must be configured (503 otherwise) and the
 * account must be under the global daily AI request cap (429). Also serves /v1/ai/status.
 */
export class AiAccessService {
  constructor(
    private readonly settings: AiSettingsService,
    private readonly usage: AiUsageRepository,
    private readonly gateway: AiGateway,
    private readonly logger: Logger,
  ) {}

  /** The config to call the model with; consumes one daily request when a cap applies. */
  async acquire(ownerId: string, purpose: AiPurpose): Promise<AiConfig> {
    const resolved = await this.settings.resolve(purpose);
    const loaded = resolved.result;
    if (!loaded.ok)
      throw new ServiceUnavailableError(loaded.reason, {
        code: "ai_not_configured",
        details: { missing: loaded.missing, purpose, source: resolved.source },
      });
    const limit = loaded.config.dailyLimit;
    if (
      limit !== null &&
      !(await this.usage.reserveDailyRequest(ownerId, limit))
    )
      throw new TooManyRequestsError(
        `Daily AI limit of ${limit} requests reached.`,
        {
          code: "ai_limit",
        },
      );
    return loaded.config;
  }

  /** GET /v1/ai/status: provider details for admins, only "configured" for everyone else. */
  async status(admin: boolean): Promise<Record<string, unknown>> {
    const [review, live] = await Promise.all(
      AI_PURPOSES.map((p) => this.purposeStatus(p)),
    );
    if (!admin)
      return {
        configured: review!.configured,
        purposes: {
          review: { configured: review!.configured },
          live: { configured: live!.configured },
        },
      };
    // Top-level fields describe the post-match review purpose (backwards compatible).
    return { ...review!, purposes: { review: review!, live: live! } };
  }

  /** POST /v1/ai/test (admin): one real call through the purpose's configuration. */
  async test(
    adminId: string,
    purpose: AiPurpose,
  ): Promise<ConnectivityResult & { purpose: AiPurpose }> {
    const config = await this.acquire(adminId, purpose);
    try {
      const result = await this.gateway.connectivityCheck(config);
      this.logger.info(
        {
          provider: result.provider,
          model: result.model,
          latencyMs: result.latencyMs,
          purpose,
        },
        "ai connectivity check",
      );
      return { ...result, purpose };
    } catch (error) {
      throw aiRequestError(error, true);
    }
  }

  private async purposeStatus(purpose: AiPurpose): Promise<PurposeStatus> {
    const r = await this.settings.resolve(purpose);
    const who = {
      source: r.source,
      ...(r.providerId
        ? { providerId: r.providerId, providerName: r.providerName }
        : {}),
    };
    if (!r.result.ok)
      return {
        configured: false,
        ...who,
        reason: r.result.reason,
        missing: r.result.missing,
      };
    const c = r.result.config;
    return {
      configured: true,
      ...who,
      provider: c.provider,
      model: c.model,
      endpoint: new URL(c.baseUrl).host,
      apiStyle: c.apiStyle,
      jsonMode: c.jsonMode,
      dailyLimit: c.dailyLimit,
      keyConfigured: !!c.apiKey,
    };
  }
}
