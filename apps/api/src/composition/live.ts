import { WebSocketBroadcaster } from "../infrastructure/realtime/live-broadcaster.js";
import { LiveController } from "../modules/live/live.controller.js";
import { LiveService } from "../modules/live/live.service.js";
import { OwnerInvalidationBus } from "../modules/live/owner-invalidation.js";
import { TicketStore } from "../modules/live/ticket-store.js";
import { InMemoryLiveSessionStore } from "../modules/telemetry/in-memory-live-session.store.js";
import { TelemetryController } from "../modules/telemetry/telemetry.controller.js";
import type { LiveSessionStore } from "../modules/telemetry/telemetry.repository.js";
import { PgLiveSessionStore } from "../modules/telemetry/telemetry.repository.js";
import { TelemetryService } from "../modules/telemetry/telemetry.service.js";
import type { Db } from "../shared/db/database.js";
import { FixedWindowRateLimiter } from "../shared/http/rate-limit.js";
import type { AppMetrics } from "../shared/logging/metrics.js";
import type { ApiConfig } from "../config/api-config.js";

/** Validates the capacity knobs of the live path (positive integers). */
export function assertCapacities(config: ApiConfig): void {
  for (const cap of [
    config.maxSessions,
    config.maxEvents,
    config.maxTickets,
    config.maxConnections,
    config.ratePerSecond,
    config.heartbeatMs,
  ])
    if (cap !== undefined && (!Number.isInteger(cap) || cap < 1))
      throw new Error(
        "Capacity and interval options must be positive integers",
      );
}

/** Telemetry ingest + live sessions/tickets/WebSockets, over Postgres or in memory. */
export function createLiveContext(
  config: ApiConfig,
  db: Db | undefined,
  metrics: AppMetrics,
) {
  const now = config.now ?? Date.now;
  const store: LiveSessionStore = db
    ? new PgLiveSessionStore(db)
    : new InMemoryLiveSessionStore(now, config.maxSessions, config.maxEvents);
  const rates = new FixedWindowRateLimiter({
    limit: config.ratePerSecond ?? 500,
    windowMs: 1000,
    capacity: 10000,
    now,
  });
  const tickets = new TicketStore(now, config.maxTickets);
  // Expires in-memory sessions/events, rate windows and tickets before each decision.
  const housekeeping = (): void => {
    store.prune();
    rates.prune();
    tickets.prune();
  };
  const broadcaster = new WebSocketBroadcaster(
    config.heartbeatMs ?? 10000,
    now,
    housekeeping,
  );
  metrics.addGauge(() => `cs2_live_connections ${broadcaster.connections}\n`);
  const live = new LiveService(store, tickets, broadcaster, housekeeping, {
    webOrigin: config.webOrigin,
    maxConnections: config.maxConnections ?? 1000,
  });
  const invalidation = new OwnerInvalidationBus();
  invalidation.subscribe((ownerId) => live.invalidateOwner(ownerId));
  return {
    store,
    broadcaster,
    invalidation,
    telemetryController: new TelemetryController(
      new TelemetryService(
        store,
        rates,
        broadcaster,
        metrics,
        housekeeping,
        now,
      ),
    ),
    liveController: new LiveController(live, broadcaster),
  };
}
export type LiveContext = ReturnType<typeof createLiveContext>;
