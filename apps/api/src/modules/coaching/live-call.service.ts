import {
  liveCoachInputSchema,
  type LiveCoachInput,
  type Personalization,
} from "@cs2/coaching";
import type {
  AiGateway,
  CoachLanguage,
} from "../../infrastructure/ai/coaching-ai-gateway.js";
import {
  AppError,
  NotFoundError,
  ValidationError,
} from "../../shared/errors/index.js";
import type { Logger } from "../../shared/logging/logger.js";
import { aiRequestError } from "../ai-config/ai-errors.js";
import type { LiveCallRequestDto } from "./coaching.dto.js";
import type {
  AiAccess,
  CoachingFeatures,
  CoachingQuota,
  LiveSessionReader,
} from "./coaching.ports.js";
import type { CoachingRepository } from "./coaching.repository.js";
import type { PersonalizationService } from "./personalization.service.js";
import type { ViewerPolicy } from "./viewer.policy.js";

type Frame = Record<string, unknown>;
const OWN_STATS = ["kills", "deaths", "assists", "health", "armor"];

/** Model input from a live/replayed frame: only the fields the live coach may see. */
export function liveInput(
  state: Frame,
  body: LiveCallRequestDto,
): ReturnType<typeof liveCoachInputSchema.safeParse> {
  const own = (state.ownStats ?? {}) as Frame;
  return liveCoachInputSchema.safeParse({
    ...(typeof state.map === "string" ? { map: state.map } : {}),
    ...(typeof state.phase === "string" ? { phase: state.phase } : {}),
    ...(typeof state.round === "number" ? { round: state.round } : {}),
    ...(state.score && typeof state.score === "object"
      ? { score: state.score }
      : {}),
    own: Object.fromEntries(
      OWN_STATS.filter((k) => typeof own[k] === "number").map((k) => [
        k,
        own[k],
      ]),
    ),
    recentRounds: body.recentRounds ?? [],
    ...(body.baseline ? { baseline: body.baseline } : {}),
  });
}

/**
 * A "live AI match" is the live session, or the replayed analysis; other calls share a
 * per-map bucket so they cannot each count as a new match.
 */
export function liveMatchKey(
  sessionId: string | null,
  analysisId: unknown,
  input: LiveCoachInput,
): string {
  if (sessionId) return `session:${sessionId}`;
  if (typeof analysisId === "string" && /^[a-f0-9-]{36}$/.test(analysisId))
    return `analysis:${analysisId}`;
  return `state:${input.map ?? "unknown"}`;
}

/** Between-rounds IGL calls (POST /v1/ai/live-call) for live sessions and replays. */
export class LiveCallService {
  constructor(
    private readonly coaching: CoachingRepository,
    private readonly sessions: LiveSessionReader,
    private readonly personalization: PersonalizationService,
    private readonly quota: CoachingQuota,
    private readonly features: CoachingFeatures,
    private readonly ai: AiAccess,
    private readonly gateway: AiGateway,
    private readonly logger: Logger,
  ) {}

  /** Live sessions use the server's authoritative state; replays send their own frame. */
  private async frame(
    ownerId: string,
    body: LiveCallRequestDto,
  ): Promise<{ state: Frame; sessionId: string | null }> {
    if (typeof body.sessionId === "string") {
      const session = await this.sessions.session(body.sessionId);
      if (!session || session.ownerId !== ownerId)
        throw new NotFoundError("Session not found");
      return {
        state: session.state as unknown as Frame,
        sessionId: body.sessionId,
      };
    }
    if (typeof body.state === "object" && body.state !== null)
      return { state: body.state as Frame, sessionId: null };
    throw new ValidationError("sessionId or state is required.");
  }

  private async personal(ownerId: string): Promise<Personalization> {
    const profile = await this.coaching.profile(ownerId);
    return profile.playerSteamId
      ? this.personalization.forPlayer(
          ownerId,
          profile.playerSteamId,
          null,
          await this.features.perMapLearning(ownerId),
        )
      : { preferences: await this.personalization.preferences(ownerId) };
  }

  async call(
    ownerId: string,
    body: LiveCallRequestDto,
    lang: CoachLanguage,
    viewer: ViewerPolicy,
  ): Promise<Record<string, unknown>> {
    const { state, sessionId } = await this.frame(ownerId, body);
    const input = liveInput(state, body);
    if (!input.success) throw new ValidationError("Invalid live data.");
    if (input.data.phase === "live")
      throw new AppError(409, "The live coach only speaks between rounds.", {
        code: "ai_between_rounds_only",
      });
    const reserved = await this.quota.reserveLiveCall(
      ownerId,
      liveMatchKey(sessionId, body.analysisId, input.data),
    );
    const config = await this.ai
      .acquire(ownerId, "live")
      .catch(async (error: unknown) => {
        await reserved.release();
        throw error;
      });
    try {
      const { call, meta } = await this.gateway.liveCall(input.data, config, {
        lang,
        personal: await this.personal(ownerId),
      });
      const id = await this.coaching.saveLiveCall({
        ownerId,
        sessionId,
        round: input.data.round ?? null,
        call,
        provider: meta.provider,
        model: meta.model,
        promptVersion: call.promptVersion,
        latencyMs: meta.latencyMs,
      });
      this.logger.info(
        {
          provider: meta.provider,
          model: meta.model,
          latencyMs: meta.latencyMs,
        },
        "ai live call",
      );
      return { id, call, meta: viewer.callMeta(meta) };
    } catch (error) {
      await reserved.release();
      throw aiRequestError(error, viewer.admin);
    }
  }
}
