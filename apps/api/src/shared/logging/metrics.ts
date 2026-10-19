import type { FastifyInstance } from "fastify";

/** Process counters exposed on /metrics (aggregates only, never identifiers). */
export class AppMetrics {
  requests = 0;
  telemetryAccepted = 0;
  private gauges: Array<() => string> = [];

  /** Adds lines rendered at scrape time (live connections, worker counters). */
  addGauge(render: () => string): void {
    this.gauges.push(render);
  }

  render(): string {
    return (
      `cs2_api_requests_total ${this.requests}\n` +
      `cs2_telemetry_accepted_total ${this.telemetryAccepted}\n` +
      this.gauges.map((render) => render()).join("")
    );
  }
}

/** Counts every response and, when enabled, prints one JSON access-log line. */
export function installRequestLogging(
  app: FastifyInstance,
  metrics: AppMetrics,
  enableLogs: boolean,
): void {
  app.addHook("onResponse", async (request, reply) => {
    metrics.requests++;
    if (enableLogs)
      console.info(
        JSON.stringify({
          time: new Date().toISOString(),
          requestId: request.id,
          method: request.method,
          route: request.routeOptions.url ?? "unmatched",
          status: reply.statusCode,
          durationMs: Math.round(reply.elapsedTime),
        }),
      );
  });
}
