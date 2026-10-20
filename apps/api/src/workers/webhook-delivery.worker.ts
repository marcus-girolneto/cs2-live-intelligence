import type { WebhookDeliverer } from "../modules/webhooks/webhook-deliverer.js";
import type { WebhooksRepository } from "../modules/webhooks/webhooks.repository.js";
import type { Logger } from "../shared/logging/logger.js";

const BATCH = 20;
const PURGE_EVERY_MS = 3_600_000;

/**
 * Webhook outbox loop (API process): turns new demo/review outcomes into deliveries, sends the
 * due ones (exponential backoff, leased with SKIP LOCKED so several API instances can share the
 * work) and purges old deliveries hourly. Runs every `intervalMs`; one run at a time.
 */
export class WebhookDeliveryWorker {
  private timer: NodeJS.Timeout | undefined;
  private running: Promise<void> | undefined;
  private lastPurge = 0;

  constructor(
    private readonly repository: WebhooksRepository,
    private readonly deliverer: WebhookDeliverer,
    private readonly logger: Logger,
    private readonly maintenance?: { purge(): Promise<void> },
    private readonly now: () => number = Date.now,
  ) {}

  /** One pass: enqueue, deliver everything due (in batches), purge when due. */
  async runOnce(): Promise<{ enqueued: number; sent: number }> {
    const enqueued = await this.repository.enqueueEvents();
    let sent = 0;
    for (;;) {
      const due = await this.repository.claimDue(BATCH);
      if (!due.length) break;
      await Promise.all(due.map((d) => this.deliverer.deliver(d)));
      sent += due.length;
      if (due.length < BATCH) break;
    }
    if (this.now() - this.lastPurge >= PURGE_EVERY_MS) {
      this.lastPurge = this.now();
      await this.repository.purge();
      await this.maintenance?.purge();
    }
    return { enqueued, sent };
  }

  start(intervalMs = 5_000): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      if (this.running) return;
      this.running = this.runOnce()
        .then(() => undefined)
        .catch((error: unknown) => {
          this.logger.info({ err: String(error) }, "webhook delivery failed");
        })
        .finally(() => {
          this.running = undefined;
        });
    }, intervalMs);
    this.timer.unref();
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    await this.running;
  }
}
