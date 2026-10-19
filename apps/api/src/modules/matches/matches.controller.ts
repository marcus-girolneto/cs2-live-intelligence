import type { FastifyReply, FastifyRequest } from "fastify";
import type { Readable } from "node:stream";
import type { AuthGuards } from "../../shared/http/guards.js";
import { ownerOf } from "../../shared/http/principal.js";
import { parseDto } from "../../shared/http/validation.js";
import {
  reprocessRequestSchema,
  type MatchDto,
  type MatchListDto,
  type NewDemoJob,
  type ReprocessResultDto,
  type SampleAvailabilityDto,
} from "./matches.dto.js";
import type { MatchesService } from "./matches.service.js";
import type { SampleDemoService } from "./sample-demo.service.js";
import {
  bodyError,
  type UploadService,
  type UploadSlot,
} from "./upload.service.js";

const slots = new WeakMap<FastifyRequest, UploadSlot>();

/** Uploads (hooks + body parser), sample import, match listing and admin reprocessing. */
export class MatchesController {
  constructor(
    private readonly matches: MatchesService,
    private readonly uploads: UploadService,
    private readonly sample: SampleDemoService,
    private readonly guards: AuthGuards,
  ) {}

  /** onRequest of the upload route: authenticate and admit before any byte is read. */
  admitUpload = async (request: FastifyRequest): Promise<void> => {
    const ownerId = await this.guards.authenticate(request);
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

  /** application/octet-stream body parser: streams the demo straight into storage. */
  parseUpload = async (
    request: FastifyRequest,
    payload: Readable,
  ): Promise<NewDemoJob> => {
    if (!slots.has(request)) throw bodyError(401, "Unauthorized upload");
    return this.uploads.store(request.headers["x-filename"], payload);
  };

  /** onResponse / onRequestAbort: frees the concurrency slot. */
  endUpload = async (request: FastifyRequest): Promise<void> => {
    slots.get(request)?.finish();
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
  ): Promise<FastifyReply> =>
    reply
      .code(202)
      .send(
        await this.uploads.enqueue(
          slots.get(request)!,
          request.body as NewDemoJob,
        ),
      );

  sampleAvailability = async (): Promise<SampleAvailabilityDto> =>
    this.sample.availability();

  importSample = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<FastifyReply> =>
    reply.code(202).send(await this.sample.import(ownerOf(request)));

  list = async (request: FastifyRequest): Promise<MatchListDto> =>
    this.matches.list(ownerOf(request));

  get = async (
    request: FastifyRequest<{ Params: { id: string } }>,
  ): Promise<MatchDto> => this.matches.get(ownerOf(request), request.params.id);

  reprocess = async (request: FastifyRequest): Promise<ReprocessResultDto> => {
    const body = parseDto(
      reprocessRequestSchema,
      request.body ?? {},
      "Body must be {} or {ownerId: string}",
    );
    return this.matches.reprocess(ownerOf(request), body.ownerId);
  };
}
