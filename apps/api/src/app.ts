import Fastify from "fastify";
import websocket from "@fastify/websocket";
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { WebSocket } from "ws";
import {
  envelopeSchema,
  liveStateSchema,
  type LiveState,
  type TelemetryEnvelope,
  type ServerMessage,
} from "@cs2/contracts";
import { registerJobs, type JobOptions } from "./jobs.js";
import type { PgRepository } from "./repository.js";
import { registerPlatform } from "./platform.js";
import { platformOpenApiPaths } from "./openapi.js";
import { zodToJsonSchema } from "zod-to-json-schema";

export interface ApiConfig {
  devices: Array<{ deviceId: string; token: string; ownerId: string }>;
  owners: Array<{ token: string; ownerId: string }>;
  webOrigin: string;
  repository?: PgRepository;
  apiPublicUrl?: string;
  steamFetch?: typeof fetch;
  jobs?: JobOptions;
  enableLogs?: boolean;
  closeRepositoryOnClose?: boolean;
  now?: () => number;
  maxSessions?: number;
  maxEvents?: number;
  maxTickets?: number;
  maxConnections?: number;
  ratePerSecond?: number;
  heartbeatMs?: number;
}
function equal(a: string, b: string): boolean {
  const first = Buffer.from(a);
  const second = Buffer.from(b);
  return first.length === second.length && timingSafeEqual(first, second);
}
/** Full projections deliberately discard unavailable fields, including fields from previous maps. */
export function project(
  event: TelemetryEnvelope,
  receivedAt: string,
): LiveState {
  const { payload: p } = event;
  const state: LiveState = {
    schemaVersion: "1.0",
    sessionId: event.sessionId,
    source: "gsi",
    visibility: "own-player",
    sequence: event.sequence,
    observedAt: event.observedAt,
    receivedAt,
  };
  if (p.map?.name !== undefined) state.map = p.map.name;
  const phase = p.round?.phase ?? p.map?.phase;
  if (phase !== undefined) state.phase = phase;
  if (p.map?.round !== undefined) state.round = p.map.round;
  const ct = p.map?.team_ct?.score;
  const t = p.map?.team_t?.score;
  if (ct !== undefined || t !== undefined)
    state.score = {
      ...(ct !== undefined ? { ct } : {}),
      ...(t !== undefined ? { t } : {}),
    };
  if (p.provider?.steamid && p.player?.steamid === p.provider.steamid) {
    const stats = { ...p.player.match_stats, ...p.player.state };
    if (Object.keys(stats).length) state.ownStats = stats;
  }
  return state;
}
export async function buildApp(config: ApiConfig) {
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
  const app = Fastify({ bodyLimit: 256 * 1024, logger: false });
  // Fastify closes hooks in reverse order: register repository disposal before worker hooks.
  if (config.repository && config.closeRepositoryOnClose)
    app.addHook("onClose", async () => config.repository!.close());
  app.setErrorHandler((error, _request, reply) => {
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    reply.code(status).send({
      error:
        status >= 500
          ? "Internal server error"
          : status === 413
            ? "Payload exceeds size limit"
            : "Invalid request",
    });
  });
  await app.register(websocket, { options: { maxPayload: 1024 } });
  const now = config.now ?? Date.now;
  const sessions = new Map<
    string,
    { ownerId: string; deviceId: string; state: LiveState; at: number }
  >();
  const events = new Map<string, number>();
  const tickets = new Map<
    string,
    { ownerId: string; sessionId: string; expires: number }
  >();
  const rates = new Map<string, { start: number; count: number }>();
  const clients = new Map<
    WebSocket,
    { ownerId: string; sessionId: string; alive: boolean }
  >();
  const revokedOwners = new Set<string>();
  async function owner(header?: string) {
    if (header && revokedOwners.has(header)) return undefined;
    if (config.repository)
      return header?.startsWith("Bearer ")
        ? config.repository.owner(header.slice(7))
        : undefined;
    return config.owners.find((entry) =>
      equal(header ?? "", `Bearer ${entry.token}`),
    )?.ownerId;
  }
  function trim<T>(map: Map<string, T>, cap: number) {
    while (map.size >= cap) {
      const key = map.keys().next().value;
      if (key === undefined) break;
      map.delete(key);
    }
  }
  function prune() {
    for (const [key, entry] of sessions)
      if (now() - entry.at > 86400000) sessions.delete(key);
    for (const [key, at] of events)
      if (now() - at > 86400000) events.delete(key);
    for (const [key, rate] of rates)
      if (now() - rate.start >= 1000) rates.delete(key);
    for (const [key, entry] of tickets)
      if (now() >= entry.expires) tickets.delete(key);
  }
  function emit(socket: WebSocket, message: ServerMessage) {
    if (socket.bufferedAmount > 1024 * 1024) {
      socket.terminate();
      clients.delete(socket);
      return;
    }
    if (socket.readyState === 1) socket.send(JSON.stringify(message));
  }
  function invalidateOwner(ownerId: string) {
    for (const [socket, client] of clients)
      if (client.ownerId === ownerId) {
        socket.terminate();
        clients.delete(socket);
      }
    for (const [key, ticket] of tickets)
      if (ticket.ownerId === ownerId) tickets.delete(key);
  }
  if (config.repository)
    await registerPlatform(app, {
      repository: config.repository,
      webOrigin: config.webOrigin,
      apiPublicUrl: config.apiPublicUrl ?? "http://127.0.0.1:4000",
      steamFetch: config.steamFetch,
      onOwnerInvalidated: invalidateOwner,
    });
  const worker =
    config.repository && config.jobs
      ? await registerJobs(app, config.repository, config.jobs)
      : undefined;
  const counters = { requests: 0, telemetryAccepted: 0 };
  app.addHook("onResponse", async (request, reply) => {
    counters.requests++;
    if (config.enableLogs)
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
  app.get("/metrics", async (_request, reply) => {
    reply.type("text/plain; version=0.0.4");
    return `cs2_api_requests_total ${counters.requests}\ncs2_telemetry_accepted_total ${counters.telemetryAccepted}\ncs2_live_connections ${clients.size}\ncs2_demo_jobs_complete_total ${worker?.counters.complete ?? 0}\ncs2_demo_jobs_failed_total ${worker?.counters.failed ?? 0}\ncs2_worker_errors_total ${worker?.counters.errors ?? 0}\n`;
  });
  if (!config.repository)
    app.post("/v1/auth/logout", async (request, reply) => {
      const id = await owner(request.headers.authorization);
      if (!id) return reply.code(401).send({ error: "Unauthorized" });
      revokedOwners.add(request.headers.authorization!);
      invalidateOwner(id);
      return reply.code(204).send();
    });
  app.get("/v1/live/sessions", async (request, reply) => {
    const id = await owner(request.headers.authorization);
    if (!id) return reply.code(401).send({ error: "Unauthorized" });
    if (config.repository) return config.repository.liveHistory(id);
    return {
      sessions: [...sessions.values()]
        .filter((s) => s.ownerId === id)
        .sort((a, b) => b.at - a.at)
        .slice(0, 100)
        .map((s) => s.state),
    };
  });
  const getSession = async (id: string) =>
    config.repository ? config.repository.session(id) : sessions.get(id);
  app.get("/health", async () => ({
    status: "ok",
    storage: config.repository ? "postgres" : "memory",
  }));
  app.get("/ready", async (_request, reply) => {
    try {
      await config.repository?.ready();
      return { status: "ready" };
    } catch {
      return reply.code(503).send({ status: "unavailable" });
    }
  });
  app.get("/openapi.json", async () => ({
    openapi: "3.0.3",
    info: {
      title: "CS2 Live Intelligence API",
      version: "1.0.0",
      description:
        "WebSocket /v1/live?sessionId=...&ticket=... requires allowed Origin and a single-use ticket. Server emits snapshot {state:LiveState|null}, diff {sessionId,sequence,changes:LiveState} and heartbeat {at:ISO8601}. Replace the full state on each diff to clear missing fields. Reconnect using a fresh ticket to receive latest snapshot.",
    },
    components: {
      securitySchemes: { bearer: { type: "http", scheme: "bearer" } },
      schemas: {
        TelemetryEnvelope: zodToJsonSchema(envelopeSchema, {
          target: "openApi3",
        }),
        LiveState: zodToJsonSchema(liveStateSchema, { target: "openApi3" }),
      },
    },
    paths: {
      ...platformOpenApiPaths,
      "/health": { get: { responses: { 200: { description: "Healthy" } } } },
      "/v1/telemetry/gsi": {
        post: {
          security: [{ bearer: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/TelemetryEnvelope" },
              },
            },
          },
          responses: {
            202: { description: "Accepted, duplicate or ignored older event" },
            400: { description: "Invalid envelope" },
            401: { description: "Invalid device token" },
            403: { description: "Device or session mismatch" },
            413: { description: "Payload too large" },
            429: { description: "Rate limited" },
          },
        },
      },
      "/v1/live/sessions/{id}": {
        get: {
          security: [{ bearer: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Latest live state",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/LiveState" },
                },
              },
            },
            401: { description: "Unauthorized" },
            404: { description: "No owned session" },
          },
        },
      },
      "/v1/live/tickets": {
        post: {
          security: [{ bearer: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["sessionId"],
                  properties: { sessionId: { type: "string", maxLength: 128 } },
                },
              },
            },
          },
          responses: {
            200: {
              description: "Single use WS ticket, expires in 30 seconds",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["ticket"],
                    properties: { ticket: { type: "string" } },
                  },
                },
              },
            },
            401: { description: "Unauthorized" },
            404: { description: "No owned session" },
          },
        },
      },
    },
  }));
  app.post("/v1/telemetry/gsi", async (request, reply) => {
    const device = config.repository
      ? await config.repository.device(
          request.headers.authorization?.startsWith("Bearer ")
            ? request.headers.authorization.slice(7)
            : "",
        )
      : config.devices.find((entry) =>
          equal(request.headers.authorization ?? "", `Bearer ${entry.token}`),
        );
    if (!device) return reply.code(401).send({ error: "Unauthorized" });
    prune();
    if (!rates.has(device.deviceId) && rates.size >= 10000)
      return reply.code(429).send({ error: "Rate capacity reached" });
    const rate = rates.get(device.deviceId);
    if (!rate || now() - rate.start >= 1000)
      rates.set(device.deviceId, { start: now(), count: 1 });
    else if (++rate.count > (config.ratePerSecond ?? 500))
      return reply.code(429).send({ error: "Rate limited" });
    const parsed = envelopeSchema.safeParse(request.body);
    if (!parsed.success || (parsed.success && parsed.data.sequence < 1))
      return reply.code(400).send({ error: "Invalid telemetry envelope" });
    const event = parsed.data;
    if (event.deviceId !== device.deviceId)
      return reply.code(403).send({ error: "Device mismatch" });
    prune();
    const state = project(event, new Date(now()).toISOString());
    if (config.repository) {
      const result = await config.repository.ingest(event, state, device);
      if (result === "forbidden" || result === "consent")
        return reply.code(403).send({
          error:
            result === "consent"
              ? "Telemetry consent required"
              : "Device or session mismatch",
        });
      if (result !== "accepted")
        return reply.code(202).send({ status: result });
    } else {
      const previous = sessions.get(event.sessionId);
      if (
        previous &&
        (previous.ownerId !== device.ownerId ||
          previous.deviceId !== device.deviceId)
      )
        return reply.code(403).send({ error: "Session mismatch" });
      const key = JSON.stringify([device.deviceId, event.eventId]);
      if (events.has(key)) return reply.code(202).send({ status: "duplicate" });
      trim(events, config.maxEvents ?? 10000);
      events.set(key, now());
      if (previous && event.sequence <= previous.state.sequence)
        return reply.code(202).send({ status: "ignored" });
      if (!previous) trim(sessions, config.maxSessions ?? 1000);
      sessions.set(event.sessionId, {
        ownerId: device.ownerId,
        deviceId: device.deviceId,
        state,
        at: now(),
      });
    }
    counters.telemetryAccepted++;
    for (const [socket, client] of clients)
      if (
        client.ownerId === device.ownerId &&
        client.sessionId === event.sessionId
      )
        emit(socket, {
          type: "diff",
          sessionId: event.sessionId,
          sequence: event.sequence,
          changes: state,
        });
    return reply
      .code(202)
      .send({ status: "accepted", sequence: state.sequence });
  });
  app.get<{ Params: { id: string } }>(
    "/v1/live/sessions/:id",
    async (request, reply) => {
      const ownerId = await owner(request.headers.authorization);
      if (!ownerId) return reply.code(401).send({ error: "Unauthorized" });
      prune();
      const session = await getSession(request.params.id);
      if (!session || session.ownerId !== ownerId)
        return reply.code(404).send({ error: "Session not found" });
      return session.state;
    },
  );
  app.post("/v1/live/tickets", async (request, reply) => {
    const ownerId = await owner(request.headers.authorization);
    if (!ownerId) return reply.code(401).send({ error: "Unauthorized" });
    const body = request.body as { sessionId?: unknown } | null;
    if (
      !body ||
      typeof body.sessionId !== "string" ||
      !body.sessionId.length ||
      body.sessionId.length > 128
    )
      return reply.code(400).send({ error: "Invalid sessionId" });
    prune();
    const session = await getSession(body.sessionId);
    if (session && session.ownerId !== ownerId)
      return reply.code(404).send({ error: "Session not found" });
    if (tickets.size >= (config.maxTickets ?? 1000))
      return reply.code(429).send({ error: "Ticket capacity reached" });
    const ticket = randomBytes(32).toString("base64url");
    tickets.set(ticket, {
      ownerId,
      sessionId: body.sessionId,
      expires: now() + 30000,
    });
    return { ticket };
  });
  app.get<{ Querystring: { sessionId?: string; ticket?: string } }>(
    "/v1/live",
    {
      websocket: true,
      preValidation: async (request, reply) => {
        if (request.headers.origin !== config.webOrigin)
          return reply.code(403).send({ error: "Origin rejected" });
        if (clients.size >= (config.maxConnections ?? 1000))
          return reply.code(429).send({ error: "Connection capacity reached" });
        prune();
        const ticket = tickets.get(request.query.ticket ?? "");
        if (!ticket || ticket.sessionId !== request.query.sessionId)
          return reply.code(401).send({ error: "Invalid ticket" });
        tickets.delete(request.query.ticket!);
        const session = await getSession(ticket.sessionId);
        if (session && session.ownerId !== ticket.ownerId)
          return reply.code(404).send({ error: "Session not found" });
        (
          request as typeof request & { liveSnapshot: LiveState | null }
        ).liveSnapshot = session?.state ?? null;
        (request as typeof request & { liveOwner: string }).liveOwner =
          ticket.ownerId;
      },
    },
    (socket, request) => {
      const ownerId = (request as typeof request & { liveOwner: string })
        .liveOwner;
      const sessionId = request.query.sessionId!;
      clients.set(socket, { ownerId, sessionId, alive: true });
      socket.on("pong", () => {
        const client = clients.get(socket);
        if (client) client.alive = true;
      });
      socket.on("close", () => clients.delete(socket));
      socket.on("error", () => clients.delete(socket));
      emit(socket, {
        type: "snapshot",
        state: (request as typeof request & { liveSnapshot: LiveState | null })
          .liveSnapshot,
      });
    },
  );
  const heartbeat = setInterval(() => {
    prune();
    for (const [socket, client] of clients) {
      if (!client.alive) {
        socket.terminate();
        clients.delete(socket);
        continue;
      }
      client.alive = false;
      socket.ping();
      emit(socket, { type: "heartbeat", at: new Date(now()).toISOString() });
    }
  }, config.heartbeatMs ?? 10000);
  heartbeat.unref();
  app.addHook("onClose", async () => {
    clearInterval(heartbeat);
    for (const socket of clients.keys()) socket.terminate();
    clients.clear();
  });
  return app;
}
