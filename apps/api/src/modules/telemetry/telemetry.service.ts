import { envelopeSchema } from "@cs2/contracts";
import type { LiveBroadcaster } from "../../infrastructure/realtime/live-broadcaster.js";
import {
  ForbiddenError,
  TooManyRequestsError,
  ValidationError,
} from "../../shared/errors/index.js";
import type { DeviceIdentity } from "../../shared/http/principal.js";
import type { FixedWindowRateLimiter } from "../../shared/http/rate-limit.js";
import type { AppMetrics } from "../../shared/logging/metrics.js";
import { project } from "./projection.js";
import type { IngestResult, LiveSessionStore } from "./telemetry.repository.js";

export type IngestResponse =
  | { status: "accepted"; sequence: number }
  | { status: "duplicate" | "ignored" };

const FORBIDDEN: Partial<Record<IngestResult, string>> = {
  forbidden: "Device or session mismatch",
  consent: "Telemetry consent required",
  session_mismatch: "Session mismatch",
};

/**
 * GSI ingest: per-device rate limit, envelope validation, projection to LiveState, durable
 * de-duplicated storage and fan-out of the new state to the owner's live channels.
 */
export class TelemetryService {
  constructor(
    private readonly store: LiveSessionStore,
    private readonly rates: FixedWindowRateLimiter,
    private readonly broadcaster: LiveBroadcaster,
    private readonly metrics: AppMetrics,
    private readonly housekeeping: () => void,
    private readonly now: () => number,
  ) {}

  async ingest(device: DeviceIdentity, body: unknown): Promise<IngestResponse> {
    this.housekeeping();
    const rate = this.rates.hit(device.deviceId);
    if (rate === "capacity")
      throw new TooManyRequestsError("Rate capacity reached");
    if (rate === "limited") throw new TooManyRequestsError("Rate limited");
    const parsed = envelopeSchema.safeParse(body);
    if (!parsed.success || parsed.data.sequence < 1)
      throw new ValidationError("Invalid telemetry envelope");
    const event = parsed.data;
    if (event.deviceId !== device.deviceId)
      throw new ForbiddenError("Device mismatch");
    this.housekeeping();
    const state = project(event, new Date(this.now()).toISOString());
    const result = await this.store.ingest(event, state, device);
    const forbidden = FORBIDDEN[result];
    if (forbidden) throw new ForbiddenError(forbidden);
    if (result === "duplicate" || result === "ignored")
      return { status: result };
    this.metrics.telemetryAccepted++;
    this.broadcaster.publish(device.ownerId, event.sessionId, {
      type: "diff",
      sessionId: event.sessionId,
      sequence: event.sequence,
      changes: state,
    });
    return { status: "accepted", sequence: state.sequence };
  }
}
