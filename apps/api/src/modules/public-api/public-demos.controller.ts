import type { FastifyReply, FastifyRequest } from "fastify";
import type { Readable } from "node:stream";
import { gzipSync } from "node:zlib";
import { ConflictError } from "../../shared/errors/index.js";
import { ownerOf } from "../../shared/http/principal.js";
import { parseDto } from "../../shared/http/validation.js";
import type { NewDemoJob } from "../matches/matches.dto.js";
import {
  bodyError,
  type UploadService,
  type UploadSlot,
} from "../matches/upload.service.js";
import type { IdempotencyStore } from "./idempotency.repository.js";
import {
  analysisQuerySchema,
  demosQuerySchema,
  idempotencyKeySchema,
} from "./public-api.dto.js";
import type { PublicDemosService } from "./public-demos.service.js";

type ById = FastifyRequest<{ Params: { id: string } }>;
type ByPlayer = FastifyRequest<{ Params: { id: string; steamId: string } }>;
const INVALID = { code: "invalid_request" } as const;
const slots = new WeakMap<FastifyRequest, UploadSlot>();
const idempotencyKeys = new WeakMap<FastifyRequest, string>();

/**
 * Sends JSON gzipped when the client accepts it and the body is worth compressing (analyses
 * with events run to megabytes).
 */
export function sendJson(
  request: FastifyRequest,
  reply: FastifyReply,
  body: unknown,
): FastifyReply {
  const json = JSON.stringify(body);
  const accepts = /\bgzip\b/.test(
    String(request.headers["accept-encoding"] ?? ""),
  );
  reply.header("content-type", "application/json; charset=utf-8");
  reply.header("vary", "Accept-Encoding");
  if (!accepts || json.length < 1024) return reply.send(json);
  return reply.header("content-encoding", "gzip").send(gzipSync(json));
}

/** /api/v1/demos: streaming upload (idempotent), listing, status, deletion and analysis. */
export class PublicDemosController {
  constructor(
    private readonly demos: PublicDemosService,
    private readonly uploads: UploadService,
    private readonly idempotency: IdempotencyStore,
  ) {}

  /**
   * Route onRequest (after the gate authenticated the key and checked matches:write): replays
   * a finished Idempotency-Key, then admits the upload exactly like the web upload (rate
   * limits, consent, concurrency, declared size, content type, plan quota).
   */
  admitUpload = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<FastifyReply | void> => {
    const ownerId = ownerOf(request);
    const header = request.headers["idempotency-key"];
    if (header !== undefined) {
      const key = parseDto(
        idempotencyKeySchema,
        header,
        "Idempotency-Key must be 1 to 128 characters of A-Z a-z 0-9 _ . : -",
        { code: "invalid_idempotency_key" },
      );
      const state = await this.idempotency.begin(ownerId, key);
      if (state.state === "done")
        return reply
          .code(state.status)
          .header("idempotent-replayed", "true")
          .send(state.response);
      if (state.state === "pending")
        throw new ConflictError(
          "A request with this Idempotency-Key is still in progress",
          { code: "idempotency_in_progress" },
        );
      idempotencyKeys.set(request, key);
    }
    slots.set(
      request,
      await this.uploads.admit(
        ownerId,
        Number(request.headers["content-length"] ?? 0),
        request.headers["content-type"],
        request.ip,
      ),
    );
  };

  /** application/octet-stream parser of the /api/v1 scope: streams into storage. */
  parseUpload = async (
    request: FastifyRequest,
    payload: Readable,
  ): Promise<NewDemoJob> => {
    if (!slots.has(request)) throw bodyError(401, "Unauthorized upload");
    return this.uploads.store(request.headers["x-filename"], payload);
  };

  /** onResponse: frees the slot; a failed request frees its idempotency key. */
  endUpload = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    slots.get(request)?.finish();
    const key = idempotencyKeys.get(request);
    if (key && reply.statusCode !== 202)
      await this.idempotency
        .abandon(ownerOf(request), key)
        .catch(() => undefined);
  };

  /** onRequestAbort: the client went away; the key can be retried. */
  abortUpload = async (request: FastifyRequest): Promise<void> => {
    slots.get(request)?.finish();
    const key = idempotencyKeys.get(request);
    if (key)
      await this.idempotency
        .abandon(ownerOf(request), key)
        .catch(() => undefined);
  };

  /** onError: frees the slot and gives the quota unit back. */
  failUpload = async (request: FastifyRequest): Promise<void> => {
    const slot = slots.get(request);
    slot?.finish();
    await slot?.releaseQuota();
  };

  upload = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<FastifyReply> => {
    const queued = await this.uploads.enqueue(
      slots.get(request)!,
      request.body as NewDemoJob,
    );
    const body = { ...queued, links: this.demos.links(queued.id, "queued") };
    const key = idempotencyKeys.get(request);
    if (key) await this.idempotency.complete(ownerOf(request), key, 202, body);
    return reply.code(202).send(body);
  };

  list = async (request: FastifyRequest): Promise<unknown> =>
    this.demos.list(
      ownerOf(request),
      parseDto(
        demosQuerySchema,
        request.query ?? {},
        "limit must be 1 to 100; ownership mine or external; cursor from nextCursor",
        INVALID,
      ),
    );

  get = async (request: ById): Promise<unknown> =>
    this.demos.get(ownerOf(request), request.params.id);

  remove = async (
    request: ById,
    reply: FastifyReply,
  ): Promise<FastifyReply> => {
    await this.demos.remove(ownerOf(request), request.params.id);
    return reply.code(204).send();
  };

  analysis = async (
    request: ById,
    reply: FastifyReply,
  ): Promise<FastifyReply> => {
    const query = parseDto(
      analysisQuerySchema,
      request.query ?? {},
      "include must be events",
      INVALID,
    );
    const body = await this.demos.analysis(
      ownerOf(request),
      request.params.id,
      query.include === "events",
    );
    return sendJson(request, reply, body);
  };

  player = async (request: ByPlayer): Promise<unknown> =>
    this.demos.player(
      ownerOf(request),
      request.params.id,
      request.params.steamId,
    );
}
