import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream";
import {
  ObjectTooLargeError,
  type ObjectStorage,
} from "../../infrastructure/storage/object-storage.js";
import {
  ForbiddenError,
  PayloadTooLargeError,
  TooManyRequestsError,
  UnsupportedMediaTypeError,
  ValidationError,
} from "../../shared/errors/index.js";
import { DemoRejectedError, demoSniffer } from "./demo-signature.js";
import { UploadRateLimiter } from "./upload-rate-limit.js";
import type { AnalysisDedupe } from "./analysis-dedupe.js";
import type { Reservation } from "../usage/usage.service.js";
import type { ConsentLookup } from "../privacy/privacy.repository.js";
import {
  uploadFilenameSchema,
  type NewDemoJob,
  type QueuedJobDto,
} from "./matches.dto.js";
import type { MatchesRepository } from "./matches.repository.js";

import type { UploadLimits } from "./upload-limits.js";
export { MAX_UPLOAD_CAP } from "./upload-limits.js";
const MAX_CONCURRENT_UPLOADS = 4;

/** Port (usage module): one upload unit of the caller's daily plan quota. */
export interface UploadQuota {
  reserveUpload(ownerId: string): Promise<Reservation>;
}

/**
 * Errors raised while the body is being parsed keep Fastify's generic bodies
 * ("Invalid request", "Payload exceeds size limit"), so they are plain errors with a status.
 */
export function bodyError(statusCode: number, message: string): Error {
  return Object.assign(new Error(message), { statusCode });
}

/** One admitted upload: holds a concurrency slot and the quota reservation until it ends. */
export class UploadSlot {
  private active = true;
  constructor(
    readonly ownerId: string,
    private reservation: Reservation | undefined,
    private readonly onFinish: () => void,
  ) {}
  /** Frees the concurrency slot (idempotent). */
  finish(): void {
    if (!this.active) return;
    this.active = false;
    this.onFinish();
  }
  /** Gives the quota unit back (idempotent). */
  async releaseQuota(): Promise<void> {
    const reservation = this.reservation;
    this.reservation = undefined;
    await reservation?.release();
  }
}

/** Streaming .dem uploads: admission, storage with a byte cap and job creation. */
export class UploadService {
  private activeUploads = 0;
  constructor(
    private readonly matches: MatchesRepository,
    private readonly storage: ObjectStorage,
    private readonly consent: ConsentLookup,
    private readonly quota: UploadQuota,
    private readonly limits: Pick<UploadLimits, "maxDemoBytes">,
    private readonly rate: UploadRateLimiter = new UploadRateLimiter(),
    private readonly dedupe?: Pick<AnalysisDedupe, "tryComplete">,
  ) {}

  /**
   * Runs before the body is read: per-account/per-network rate, consent, concurrency, declared
   * size, type, plan quota.
   */
  async admit(
    ownerId: string,
    contentLength: number,
    contentType: string | undefined,
    ip?: string,
  ): Promise<UploadSlot> {
    this.rate.check(ownerId, ip);
    if (!(await this.consent.settings(ownerId)).telemetryConsent)
      throw new ForbiddenError("Telemetry consent required");
    if (this.activeUploads >= MAX_CONCURRENT_UPLOADS)
      throw new TooManyRequestsError("Upload concurrency reached");
    if (contentLength > (await this.limits.maxDemoBytes()))
      throw new PayloadTooLargeError("Demo upload exceeds size limit", {
        code: "too_large",
      });
    if (contentType !== "application/octet-stream")
      throw new UnsupportedMediaTypeError("Use application/octet-stream");
    const reservation = await this.quota.reserveUpload(ownerId);
    this.activeUploads++;
    return new UploadSlot(ownerId, reservation, () => this.activeUploads--);
  }

  /**
   * Streams the body into storage (content-type parser) through the demo sniffer: the declared
   * content type is not trusted, the bytes are. Throws status errors; the partial object is
   * removed on any failure.
   */
  async store(filename: unknown, body: Readable): Promise<NewDemoJob> {
    const name = uploadFilenameSchema.safeParse(filename);
    if (!name.success) throw bodyError(400, "Valid .dem filename required");
    const id = randomUUID();
    const objectKey = id + ".dem";
    try {
      const stored = await this.storage.write(
        objectKey,
        pipeline(body, demoSniffer(), () => undefined),
        await this.limits.maxDemoBytes(),
      );
      if (!stored.size) {
        await this.storage.remove(objectKey);
        throw bodyError(400, "Empty demo upload");
      }
      return { id, filename: name.data, objectKey, ...stored };
    } catch (error) {
      if (error instanceof ObjectTooLargeError)
        throw new PayloadTooLargeError("Demo upload exceeds size limit", {
          code: "too_large",
        });
      if (error instanceof DemoRejectedError)
        throw new ValidationError(
          error.reason === "too_small"
            ? "This file is too small to be a CS2 match demo"
            : "This file is not a CS2 demo (.dem recorded by Counter-Strike 2)",
          { code: error.reason },
        );
      throw error;
    }
  }

  /**
   * Queues the stored file; on any failure removes it and returns the quota unit. A demo already
   * analysed by the current parser (same checksum, any account) completes right away by copy;
   * the response stays `queued` (the match list shows it complete on the next poll).
   */
  async enqueue(slot: UploadSlot, file: NewDemoJob): Promise<QueuedJobDto> {
    let queued: QueuedJobDto;
    try {
      queued = await this.matches.createJob(slot.ownerId, file);
    } catch {
      await this.storage.remove(file.objectKey);
      await slot.releaseQuota();
      throw new TooManyRequestsError(
        "Upload quota reached or consent withdrawn",
      );
    }
    await this.dedupe
      ?.tryComplete({ id: file.id, checksum: file.checksum })
      .catch(() => false);
    return queued;
  }
}
