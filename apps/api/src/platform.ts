import type { FastifyInstance, FastifyRequest } from "fastify";
import { timingSafeEqual } from "node:crypto";
import {
  pairingRequestSchema,
  pairingClaimSchema,
  settingsSchema,
} from "@cs2/contracts";
import type { PgRepository } from "./repository.js";
export interface PlatformOptions {
  repository: PgRepository;
  webOrigin: string;
  apiPublicUrl: string;
  steamFetch?: typeof fetch;
  onOwnerInvalidated?: (ownerId: string) => void;
}
const steamEndpoint = "https://steamcommunity.com/openid/login";
const bearer = (request: FastifyRequest) =>
  request.headers.authorization?.startsWith("Bearer ")
    ? request.headers.authorization.slice(7)
    : "";
export async function registerPlatform(
  app: FastifyInstance,
  options: PlatformOptions,
) {
  const { repository: repo } = options;
  const owner = async (request: FastifyRequest) => {
    const token = bearer(request);
    return token ? repo.owner(token) : undefined;
  };
  const authRates = new Map<string, { count: number; start: number }>();
  app.addHook("onRequest", async (request, reply) => {
    if (
      !request.url.startsWith("/v1/auth/") &&
      !request.url.startsWith("/v1/devices/claim")
    )
      return;
    const key = request.ip;
    const time = Date.now();
    for (const [id, rate] of authRates)
      if (time - rate.start > 60000) authRates.delete(id);
    if (!authRates.has(key) && authRates.size >= 10000)
      return reply.code(429).send({ error: "Authentication capacity reached" });
    const rate = authRates.get(key) ?? { count: 0, start: time };
    rate.count++;
    authRates.set(key, rate);
    if (rate.count > 30)
      return reply.code(429).send({ error: "Authentication rate limited" });
  });
  app.post("/v1/auth/logout", async (request, reply) => {
    const id = await owner(request);
    if (!id) return reply.code(401).send({ error: "Unauthorized" });
    await repo.logout(bearer(request));
    options.onOwnerInvalidated?.(id);
    return reply.code(204).send();
  });
  app.get("/v1/me", async (request, reply) => {
    const id = await owner(request);
    if (!id) return reply.code(401).send({ error: "Unauthorized" });
    return repo.me(id);
  });
  app.get("/v1/settings", async (request, reply) => {
    const id = await owner(request);
    if (!id) return reply.code(401).send({ error: "Unauthorized" });
    return repo.settings(id);
  });
  app.put("/v1/settings", async (request, reply) => {
    const id = await owner(request);
    if (!id) return reply.code(401).send({ error: "Unauthorized" });
    const s = settingsSchema.safeParse(request.body);
    if (!s.success) return reply.code(400).send({ error: "Invalid settings" });
    const settings = await repo.updateSettings(id, s.data);
    if (!settings.telemetryConsent) options.onOwnerInvalidated?.(id);
    return settings;
  });
  app.get("/v1/devices", async (request, reply) => {
    const id = await owner(request);
    if (!id) return reply.code(401).send({ error: "Unauthorized" });
    return repo.devices(id);
  });
  app.post("/v1/devices/pair", async (request, reply) => {
    const id = await owner(request);
    if (!id) return reply.code(401).send({ error: "Unauthorized" });
    const parsed = pairingRequestSchema.safeParse(request.body);
    if (!parsed.success)
      return reply.code(400).send({ error: "Invalid pairing request" });
    try {
      return await repo.pair(id, parsed.data.name);
    } catch {
      return reply.code(429).send({ error: "Pairing limit reached" });
    }
  });
  app.post("/v1/devices/claim", async (request, reply) => {
    const parsed = pairingClaimSchema.safeParse(request.body);
    if (!parsed.success)
      return reply.code(400).send({ error: "Invalid pairing code" });
    const claimed = await repo.claim(parsed.data.code);
    return (
      claimed ??
      reply.code(400).send({ error: "Invalid or expired pairing code" })
    );
  });
  app.post<{ Params: { id: string } }>(
    "/v1/devices/:id/rotate",
    async (request, reply) => {
      const id = await owner(request);
      if (!id) return reply.code(401).send({ error: "Unauthorized" });
      const rotated = await repo.rotate(id, request.params.id);
      if (!rotated) return reply.code(404).send({ error: "Device not found" });
      options.onOwnerInvalidated?.(id);
      return rotated;
    },
  );
  app.delete<{ Params: { id: string } }>(
    "/v1/devices/:id",
    async (request, reply) => {
      const id = await owner(request);
      if (!id) return reply.code(401).send({ error: "Unauthorized" });
      if (!(await repo.revoke(id, request.params.id)))
        return reply.code(404).send({ error: "Device not found" });
      options.onOwnerInvalidated?.(id);
      return reply.code(204).send();
    },
  );
  app.delete("/v1/account", async (request, reply) => {
    const id = await owner(request);
    if (!id) return reply.code(401).send({ error: "Unauthorized" });
    await repo.deleteAccount(id);
    options.onOwnerInvalidated?.(id);
    return reply.code(204).send();
  });
  app.get("/v1/auth/steam/start", async (_request, reply) => {
    const state = await repo.createOpenIdState();
    const callback = new URL("/v1/auth/steam/callback", options.apiPublicUrl);
    callback.searchParams.set("state", state);
    const url = new URL(steamEndpoint);
    url.search = new URLSearchParams({
      "openid.ns": "http://specs.openid.net/auth/2.0",
      "openid.mode": "checkid_setup",
      "openid.return_to": callback.toString(),
      "openid.realm": new URL(options.apiPublicUrl).origin + "/",
      "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
      "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
    }).toString();
    reply.header("cache-control", "no-store");
    reply.header(
      "set-cookie",
      `cs2_steam_state=${state}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600${options.apiPublicUrl.startsWith("https:") ? "; Secure" : ""}`,
    );
    return { url: url.toString() };
  });
  app.get<{ Querystring: Record<string, string> }>(
    "/v1/auth/steam/callback",
    async (request, reply) => {
      reply.header("cache-control", "no-store");
      reply.header(
        "set-cookie",
        "cs2_steam_state=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
      );
      const q = request.query;
      if (Object.values(q).some((value) => typeof value !== "string"))
        return reply.code(400).send({ error: "Invalid OpenID response" });
      const state = q.state;
      const cookie = request.headers.cookie
        ?.split(";")
        .map((v) => v.trim())
        .find((v) => v.startsWith("cs2_steam_state="))
        ?.slice("cs2_steam_state=".length);
      const reject = () =>
        reply.code(400).send({ error: "Steam authentication rejected" });
      if (
        typeof state !== "string" ||
        typeof cookie !== "string" ||
        state.length > 128 ||
        Buffer.byteLength(state) !== Buffer.byteLength(cookie) ||
        !timingSafeEqual(Buffer.from(state), Buffer.from(cookie))
      )
        return reject();
      const callback = new URL("/v1/auth/steam/callback", options.apiPublicUrl);
      callback.searchParams.set("state", state);
      if (
        q["openid.ns"] !== "http://specs.openid.net/auth/2.0" ||
        q["openid.mode"] !== "id_res" ||
        q["openid.op_endpoint"] !== steamEndpoint ||
        q["openid.return_to"] !== callback.toString()
      )
        return reject();
      const claimed = q["openid.claimed_id"];
      if (
        typeof claimed !== "string" ||
        !/^https:\/\/steamcommunity\.com\/openid\/id\/[0-9]{17}$/.test(
          claimed,
        ) ||
        q["openid.identity"] !== claimed
      )
        return reject();
      const nonce = q["openid.response_nonce"];
      if (typeof nonce !== "string" || nonce.length > 256) return reject();
      const nonceTime = Date.parse(nonce.slice(0, 20));
      if (
        !Number.isFinite(nonceTime) ||
        Math.abs(Date.now() - nonceTime) > 300000
      )
        return reject();
      const signed = new Set((q["openid.signed"] ?? "").split(","));
      if (
        ![
          "op_endpoint",
          "claimed_id",
          "identity",
          "return_to",
          "response_nonce",
          "assoc_handle",
        ].every((v) => signed.has(v))
      )
        return reject();
      const fields = new URLSearchParams();
      for (const [key, value] of Object.entries(q))
        if (
          key.startsWith("openid.") &&
          typeof value === "string" &&
          value.length <= 8192
        )
          fields.set(key, value);
      fields.set("openid.mode", "check_authentication");
      try {
        const response = await (options.steamFetch ?? fetch)(steamEndpoint, {
          method: "POST",
          body: fields,
          redirect: "error",
          signal: AbortSignal.timeout(5000),
        });
        const body = await response.text();
        if (
          !response.ok ||
          body.length > 8192 ||
          !body.split(/\r?\n/).includes("is_valid:true")
        )
          return reject();
      } catch {
        return reply
          .code(502)
          .send({ error: "Steam verification unavailable" });
      }
      const code = await repo.finishOpenId(
        state,
        nonce,
        claimed.split("/").at(-1)!,
      );
      if (!code) return reject();
      const destination = new URL("/auth/callback", options.webOrigin);
      destination.searchParams.set("code", code.code);
      reply.header("set-cookie", [
        "cs2_steam_state=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
        `cs2_steam_exchange=${code.binding}; HttpOnly; SameSite=Lax; Path=/; Max-Age=60${options.apiPublicUrl.startsWith("https:") ? "; Secure" : ""}`,
      ]);
      return reply.redirect(destination.toString());
    },
  );
  app.post("/v1/auth/exchange", async (request, reply) => {
    const body = request.body as { code?: unknown } | null;
    if (!body || typeof body.code !== "string" || body.code.length > 128)
      return reply.code(400).send({ error: "Invalid code" });
    const binding =
      request.headers.cookie
        ?.split(";")
        .map((value) => value.trim())
        .find((value) => value.startsWith("cs2_steam_exchange="))
        ?.slice("cs2_steam_exchange=".length) ?? "";
    if (!binding || binding.length > 128)
      return reply.code(400).send({ error: "Invalid exchange binding" });
    const result = await repo.exchange(body.code, binding);
    reply.header(
      "set-cookie",
      "cs2_steam_exchange=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
    );
    reply.header("cache-control", "no-store");
    return (
      result ?? reply.code(400).send({ error: "Expired or consumed code" })
    );
  });
}
