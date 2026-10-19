import { describe, expect, it } from "vitest";
import type { TelemetryEnvelope } from "@cs2/contracts";
import { LiveService } from "../../src/modules/live/live.service.js";
import { TicketStore } from "../../src/modules/live/ticket-store.js";
import { InMemoryLiveSessionStore } from "../../src/modules/telemetry/in-memory-live-session.store.js";
import { TelemetryService } from "../../src/modules/telemetry/telemetry.service.js";
import { FixedWindowRateLimiter } from "../../src/shared/http/rate-limit.js";
import { AppMetrics } from "../../src/shared/logging/metrics.js";
import { appError, FakeBroadcaster } from "./fakes.js";

const device = { deviceId: "d1", ownerId: "a" };
const event = (
  sequence: number,
  over: Partial<TelemetryEnvelope> = {},
): TelemetryEnvelope => ({
  schemaVersion: "1.0",
  eventId: `e${sequence}`,
  deviceId: "d1",
  sessionId: "s1",
  sequence,
  observedAt: "2026-10-19T12:00:00.000Z",
  receivedAt: "2026-10-19T12:00:00.000Z",
  source: "gsi",
  visibility: "own-player",
  payload: { map: { name: "de_mirage", phase: "live", round: 2 } },
  ...over,
});

function setup(
  options: { rate?: number; tickets?: number; maxConnections?: number } = {},
) {
  let now = Date.parse("2026-10-19T12:00:00Z");
  const clock = () => now;
  const store = new InMemoryLiveSessionStore(clock);
  const rates = new FixedWindowRateLimiter({
    limit: options.rate ?? 100,
    windowMs: 1000,
    capacity: 2,
    now: clock,
  });
  const tickets = new TicketStore(clock, options.tickets ?? 10);
  const broadcaster = new FakeBroadcaster();
  const metrics = new AppMetrics();
  const housekeeping = () => {
    store.prune();
    rates.prune();
    tickets.prune();
  };
  return {
    broadcaster,
    metrics,
    advance: (ms: number) => (now += ms),
    telemetry: new TelemetryService(
      store,
      rates,
      broadcaster,
      metrics,
      housekeeping,
      clock,
    ),
    live: new LiveService(store, tickets, broadcaster, housekeeping, {
      webOrigin: "https://app",
      maxConnections: options.maxConnections ?? 5,
    }),
  };
}

describe("TelemetryService", () => {
  it("accepts, projects and publishes a diff to the owner's session channel", async () => {
    const s = setup();
    expect(await s.telemetry.ingest(device, event(1))).toEqual({
      status: "accepted",
      sequence: 1,
    });
    expect(s.metrics.telemetryAccepted).toBe(1);
    expect(s.broadcaster.published[0]).toMatchObject({
      ownerId: "a",
      sessionId: "s1",
      message: {
        type: "diff",
        sequence: 1,
        changes: { map: "de_mirage", round: 2, phase: "live" },
      },
    });
  });
  it("reports duplicates and older sequences without publishing", async () => {
    const s = setup();
    await s.telemetry.ingest(device, event(2));
    expect(await s.telemetry.ingest(device, event(2))).toEqual({
      status: "duplicate",
    });
    expect(await s.telemetry.ingest(device, event(1))).toEqual({
      status: "ignored",
    });
    expect(s.broadcaster.published).toHaveLength(1);
  });
  it("rejects bad envelopes, foreign devices and sessions of other devices", async () => {
    const s = setup();
    expect(
      (await appError(s.telemetry.ingest(device, { nope: true }))).body,
    ).toEqual({ error: "Invalid telemetry envelope" });
    expect((await appError(s.telemetry.ingest(device, event(0)))).status).toBe(
      400,
    );
    expect(
      (await appError(s.telemetry.ingest(device, event(1, { deviceId: "d2" }))))
        .body,
    ).toEqual({ error: "Device mismatch" });
    await s.telemetry.ingest(device, event(1));
    const other = { deviceId: "d2", ownerId: "a" };
    expect(
      await appError(s.telemetry.ingest(other, event(2, { deviceId: "d2" }))),
    ).toMatchObject({
      status: 403,
      body: { error: "Session mismatch" },
    });
  });
  it("rate limits per device per second and caps tracked devices", async () => {
    const s = setup({ rate: 2 });
    await s.telemetry.ingest(device, event(1));
    await s.telemetry.ingest(device, event(2));
    expect((await appError(s.telemetry.ingest(device, event(3)))).body).toEqual(
      { error: "Rate limited" },
    );
    s.advance(1000);
    expect((await s.telemetry.ingest(device, event(4))).status).toBe(
      "accepted",
    );
    await s.telemetry.ingest(
      { deviceId: "d2", ownerId: "b" },
      event(1, { deviceId: "d2", sessionId: "s2" }),
    );
    const third = { deviceId: "d3", ownerId: "c" };
    expect(
      (
        await appError(
          s.telemetry.ingest(
            third,
            event(1, { deviceId: "d3", sessionId: "s3" }),
          ),
        )
      ).body,
    ).toEqual({
      error: "Rate capacity reached",
    });
  });
});

describe("LiveService", () => {
  it("scopes sessions to their owner", async () => {
    const s = setup();
    await s.telemetry.ingest(device, event(1));
    expect((await s.live.session("a", "s1")).sequence).toBe(1);
    expect((await appError(s.live.session("b", "s1"))).body).toEqual({
      error: "Session not found",
    });
    expect((await s.live.sessions("a")).sessions).toHaveLength(1);
    expect((await s.live.sessions("b")).sessions).toEqual([]);
  });
  it("issues single-use tickets that expire after 30 s", async () => {
    const s = setup();
    await s.telemetry.ingest(device, event(1));
    expect((await appError(s.live.ticket("b", "s1"))).status).toBe(404);
    const { ticket } = await s.live.ticket("a", "s1");
    const admission = await s.live.admit("https://app", {
      ticket,
      sessionId: "s1",
    });
    expect(admission).toMatchObject({
      ownerId: "a",
      sessionId: "s1",
      snapshot: { sequence: 1 },
    });
    expect(
      (await appError(s.live.admit("https://app", { ticket, sessionId: "s1" })))
        .status,
    ).toBe(401);
    const late = (await s.live.ticket("a", "s1")).ticket;
    s.advance(30_000);
    expect(
      (
        await appError(
          s.live.admit("https://app", { ticket: late, sessionId: "s1" }),
        )
      ).body,
    ).toEqual({
      error: "Invalid ticket",
    });
  });
  it("checks origin, connection capacity, ticket session and ticket capacity", async () => {
    const s = setup({ tickets: 1, maxConnections: 1 });
    const { ticket } = await s.live.ticket("a", "new-session");
    expect(
      (
        await appError(
          s.live.admit("https://evil", { ticket, sessionId: "new-session" }),
        )
      ).body,
    ).toEqual({
      error: "Origin rejected",
    });
    expect(
      (
        await appError(
          s.live.admit("https://app", { ticket, sessionId: "other" }),
        )
      ).status,
    ).toBe(401);
    expect((await appError(s.live.ticket("a", "x"))).body).toEqual({
      error: "Ticket capacity reached",
    });
    s.broadcaster.connections = 1;
    expect(
      (
        await appError(
          s.live.admit("https://app", { ticket, sessionId: "new-session" }),
        )
      ).status,
    ).toBe(429);
  });
  it("invalidating an owner drops their sockets and pending tickets", async () => {
    const s = setup();
    const { ticket } = await s.live.ticket("a", "s1");
    s.live.invalidateOwner("a");
    expect(s.broadcaster.disconnected).toEqual(["a"]);
    expect(
      (await appError(s.live.admit("https://app", { ticket, sessionId: "s1" })))
        .status,
    ).toBe(401);
  });
});
