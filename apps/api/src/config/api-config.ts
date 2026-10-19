import type { PaymentGateway } from "../infrastructure/billing/payment-gateway.js";
import type {
  AiGateway,
  OfflineCoach,
} from "../infrastructure/ai/coaching-ai-gateway.js";
import type { RuntimeEnv } from "./env.js";
import type { StaticDevice, StaticOwner } from "../modules/auth/identity.js";
import type { Clock } from "../shared/clock/clock.js";
import type { Database } from "../shared/db/database.js";
import type { Logger } from "../shared/logging/logger.js";
import type { WorkerOptions } from "../workers/worker-scheduler.js";
import type { DemoParser } from "../infrastructure/parser/demo-parser.js";
import type { JobQueueRepository } from "../modules/matches/job-queue.repository.js";

/** Demo storage, parser and worker settings (database mode only). */
export interface JobOptions extends WorkerOptions {
  storageDir: string;
  parserBin: string;
  maxUploadBytes?: number;
  parserTimeoutMs?: number;
}

/**
 * Everything buildApp needs. Production passes values from AppConfig; tests pass fakes. Any
 * infrastructure dependency can be overridden here (Dependency Injection via the container).
 */
export interface ApiConfig {
  /** Static identities for the database-less mode (ignored when `database` is set). */
  devices: StaticDevice[];
  owners: StaticOwner[];
  webOrigin: string;
  database?: Database;
  apiPublicUrl?: string;
  jobs?: JobOptions;
  enableLogs?: boolean;
  closeDatabaseOnClose?: boolean;
  /** Millisecond clock of the live path (tickets, in-memory sessions, receivedAt). */
  now?: () => number;
  maxSessions?: number;
  maxEvents?: number;
  maxTickets?: number;
  maxConnections?: number;
  ratePerSecond?: number;
  heartbeatMs?: number;
  /** Steam HTTP override (tests); default: the global fetch at call time. */
  steamFetch?: typeof fetch;
  /** Fetch used for AI provider model listings. */
  fetch?: typeof fetch;
  /** Fetch used by the Stripe gateway and the integration "Test" probes (tests). */
  integrationFetch?: typeof fetch;
  /**
   * Payment gateway override (tests); null disables billing. Default: Stripe resolved per call
   * from the admin-managed integration settings (env STRIPE_* as bootstrap fallback).
   */
  paymentGateway?: PaymentGateway | null;
  /** Quota day clock override (tests); default: admin setting `timezone` (APP_TIMEZONE fallback). */
  clock?: Clock;
  /** Operator-tunable environment (tests may pass a fixed source). */
  env?: RuntimeEnv;
  /** Model gateway override (tests); default @cs2/coaching. */
  aiGateway?: AiGateway & OfflineCoach;
  logger?: Logger;
  /** Adapter/repository overrides for the background worker (tests). */
  overrides?: { jobQueue?: JobQueueRepository; demoParser?: DemoParser };
}
