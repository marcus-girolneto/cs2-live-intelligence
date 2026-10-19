import { afterEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import type { AddressInfo } from "node:net";
import { buildApp, type ApiConfig } from "../src/app.js";
import type { ServerMessage, TelemetryEnvelope } from "@cs2/contracts";
const config: ApiConfig = {
  devices: [
    { deviceId: "d1", token: "device-one", ownerId: "a" },
    { deviceId: "d2", token: "device-two", ownerId: "b" },
  ],
  owners: [
    { token: "web-one", ownerId: "a" },
    { token: "web-two", ownerId: "b" },
  ],
  webOrigin: "http://127.0.0.1:3000",
};
const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
const sockets: WebSocket[] = [];
afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.terminate();
  await Promise.all(apps.splice(0).map((app) => app.close()));
});
async function setup(options: Partial<ApiConfig> = {}) {
  const app = await buildApp({ ...config, ...options });
  apps.push(app);
  return app;
}
function event(
  sequence = 1,
  payload: TelemetryEnvelope["payload"] = {
    map: { name: "de_mirage", round: 2, team_ct: { score: 0 } },
    provider: { steamid: "123" },
    player: { steamid: "123", state: { health: 0 }, match_stats: { kills: 0 } },
  },
): TelemetryEnvelope {
  return {
    schemaVersion: "1.0",
    eventId: `event-${sequence}`,
    deviceId: "d1",
    sessionId: "s1",
    sequence,
    observedAt: "2026-10-19T12:00:00.000Z",
    receivedAt: "2020-01-01T00:00:00.000Z",
    source: "gsi",
    visibility: "own-player",
    payload,
  };
}
function ingest(
  app: Awaited<ReturnType<typeof buildApp>>,
  body: unknown,
  token = "device-one",
) {
  return app.inject({
    method: "POST",
    url: "/v1/telemetry/gsi",
    headers: { authorization: `Bearer ${token}` },
    payload: body as object,
  });
}
function read(
  app: Awaited<ReturnType<typeof buildApp>>,
  token = "web-one",
  session = "s1",
) {
  return app.inject({
    url: `/v1/live/sessions/${session}`,
    headers: { authorization: `Bearer ${token}` },
  });
}
async function ticket(
  app: Awaited<ReturnType<typeof buildApp>>,
  sessionId = "s1",
  token = "web-one",
) {
  return app.inject({
    method: "POST",
    url: "/v1/live/tickets",
    headers: { authorization: `Bearer ${token}` },
    payload: { sessionId },
  });
}
async function connect(
  app: Awaited<ReturnType<typeof buildApp>>,
  ticketValue: string,
  origin = config.webOrigin,
) {
  if (!app.server.listening) await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address() as AddressInfo;
  const socket = new WebSocket(
    `ws://127.0.0.1:${address.port}/v1/live?sessionId=s1&ticket=${ticketValue}`,
    { origin },
  );
  sockets.push(socket);
  const messages: ServerMessage[] = [];
  socket.on("message", (data) => messages.push(JSON.parse(data.toString())));
  await new Promise<void>((resolve, reject) => {
    socket.once("open", () => resolve());
    socket.once("error", reject);
  });
  return { socket, messages };
}
async function until(predicate: () => boolean) {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Timed out waiting for websocket message");
}
describe("Day 1 ingest", () => {
  it("projects own values, retains zero, overwrites arrival time and strips arbitrary GSI data", async () => {
    const app = await setup({
      now: () => Date.parse("2026-10-19T12:00:01.000Z"),
    });
    const data = event();
    (data.payload as object & { allplayers: unknown }).allplayers = {
      secret: "enemy",
    };
    expect((await ingest(app, data)).statusCode).toBe(202);
    expect((await read(app)).json()).toEqual({
      schemaVersion: "1.0",
      sessionId: "s1",
      source: "gsi",
      visibility: "own-player",
      sequence: 1,
      observedAt: data.observedAt,
      receivedAt: "2026-10-19T12:00:01.000Z",
      map: "de_mirage",
      round: 2,
      score: { ct: 0 },
      ownStats: { kills: 0, health: 0 },
    });
  });
  it("deduplicates by device/event across sessions and ignores out of order delivery", async () => {
    const app = await setup();
    expect((await ingest(app, event(3))).json().status).toBe("accepted");
    expect((await ingest(app, event(3))).json().status).toBe("duplicate");
    expect(
      (await ingest(app, { ...event(3), sessionId: "s2" })).json().status,
    ).toBe("duplicate");
    expect((await read(app, "web-one", "s2")).statusCode).toBe(404);
    expect((await ingest(app, event(2))).json().status).toBe("ignored");
    expect((await read(app)).json().sequence).toBe(3);
  });
  it("clears missing fields and hides observer/non-own stats including missing identity", async () => {
    const app = await setup();
    await ingest(app, event());
    await ingest(app, event(2, {}));
    const state = (await read(app)).json();
    expect(state.map).toBeUndefined();
    expect(state.score).toBeUndefined();
    expect(state.ownStats).toBeUndefined();
    let sequence = 3;
    for (const payload of [
      {
        provider: { steamid: "123" },
        player: { steamid: "456", match_stats: { kills: 99 } },
      },
      { player: { match_stats: { kills: 99 } } },
    ]) {
      await ingest(app, event(sequence++, payload));
      expect((await read(app)).json().ownStats).toBeUndefined();
    }
  });
  it("rejects untrusted identities, schema violations, zero sequence and huge bodies", async () => {
    const app = await setup();
    expect((await ingest(app, event(), "bad")).statusCode).toBe(401);
    expect((await ingest(app, { ...event(), deviceId: "d2" })).statusCode).toBe(
      403,
    );
    expect((await ingest(app, { ...event(), userId: "b" })).statusCode).toBe(
      400,
    );
    expect((await ingest(app, { ...event(), sequence: 0 })).statusCode).toBe(
      400,
    );
    expect(
      (await ingest(app, event(1, { player: { state: { health: 101 } } })))
        .statusCode,
    ).toBe(400);
    expect((await ingest(app, { huge: "x".repeat(300000) })).statusCode).toBe(
      413,
    );
  });
  it("enforces owner reads, ticket access, and device session identity", async () => {
    const app = await setup();
    await ingest(app, event());
    expect((await read(app, "bad")).statusCode).toBe(401);
    expect((await read(app, "web-two")).statusCode).toBe(404);
    expect((await ticket(app, "s1", "web-two")).statusCode).toBe(404);
    expect(
      (await ingest(app, { ...event(2), deviceId: "d2" }, "device-two"))
        .statusCode,
    ).toBe(403);
  });
  it("bounds rates, sessions, deduplication and tickets", async () => {
    let time = 100000;
    const app = await setup({
      now: () => time,
      maxSessions: 1,
      maxEvents: 1,
      maxTickets: 1,
      ratePerSecond: 2,
    });
    expect((await ingest(app, event())).statusCode).toBe(202);
    expect(
      (await ingest(app, { ...event(2), sessionId: "s2" })).statusCode,
    ).toBe(202);
    expect((await read(app)).statusCode).toBe(404);
    expect((await ingest(app, event(3))).statusCode).toBe(429);
    time += 1001;
    expect((await ingest(app, event(3))).statusCode).toBe(202);
    expect((await ticket(app)).statusCode).toBe(200);
    expect((await ticket(app)).statusCode).toBe(429);
    time += 30000;
    expect((await ticket(app)).statusCode).toBe(200);
  });
  it("ingests 100 sequential mock updates", async () => {
    const app = await setup();
    for (let i = 1; i <= 100; i++)
      expect((await ingest(app, event(i))).statusCode).toBe(202);
    expect((await read(app)).json().sequence).toBe(100);
  });
});
describe("authenticated live delivery", () => {
  it("sends null, complete diff, heartbeat and current snapshot on reconnect", async () => {
    const app = await setup({ heartbeatMs: 25 });
    const issued = (await ticket(app)).json().ticket;
    const first = await connect(app, issued);
    await until(() => first.messages.length > 0);
    expect(first.messages[0]).toEqual({ type: "snapshot", state: null });
    await ingest(app, event());
    await until(() => first.messages.some((m) => m.type === "diff"));
    await ingest(app, event(2, {}));
    await until(() =>
      first.messages.some((m) => m.type === "diff" && m.sequence === 2),
    );
    const latest = first.messages.find(
      (m) => m.type === "diff" && m.sequence === 2,
    ) as Extract<ServerMessage, { type: "diff" }>;
    expect(latest.changes.map).toBeUndefined();
    expect(latest.changes.ownStats).toBeUndefined();
    await until(() => first.messages.some((m) => m.type === "heartbeat"));
    first.socket.terminate();
    const second = await connect(app, (await ticket(app)).json().ticket);
    await until(() => second.messages.length > 0);
    expect(second.messages[0]).toEqual({
      type: "snapshot",
      state: (await read(app)).json(),
    });
  });
  it("rejects ticket replay, wrong origin, expired tickets and unauthenticated upgrades", async () => {
    let time = 100000;
    const app = await setup({ now: () => time });
    const issued = (await ticket(app)).json().ticket;
    await connect(app, issued);
    await expect(connect(app, issued)).rejects.toThrow("401");
    const second = (await ticket(app)).json().ticket;
    await expect(connect(app, second, "http://evil.example")).rejects.toThrow(
      "403",
    );
    time += 30000;
    await expect(connect(app, second)).rejects.toThrow("401");
    await expect(connect(app, "bad")).rejects.toThrow("401");
  });
  it("never broadcasts another owner session to a preissued unknown-session ticket", async () => {
    const app = await setup();
    const foreign = await connect(
      app,
      (await ticket(app, "s1", "web-two")).json().ticket,
    );
    await until(() => foreign.messages.length > 0);
    await ingest(app, event());
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(foreign.messages).toEqual([{ type: "snapshot", state: null }]);
  });
});

it("logs out memory browser credential and closes existing live channels", async () => {
  const app = await setup();
  await ingest(app, event());
  const live = await connect(app, (await ticket(app)).json().ticket);
  await until(() => live.messages.length > 0);
  const before = (await app.inject({ url: "/metrics" })).body.match(
    /cs2_telemetry_accepted_total (\d+)/,
  )?.[1];
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/v1/auth/logout",
        headers: { authorization: "Bearer web-one" },
      })
    ).statusCode,
  ).toBe(204);
  await until(() => live.socket.readyState === WebSocket.CLOSED);
  expect((await read(app)).statusCode).toBe(401);
  expect((await ticket(app)).statusCode).toBe(401);
  expect((await app.inject({ url: "/metrics" })).body).toContain(
    "cs2_telemetry_accepted_total " + before,
  );
});
