import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";
import {
  ObjectTooLargeError,
  type ObjectStorage,
} from "../../infrastructure/storage/object-storage.js";
import {
  ForbiddenError,
  PayloadTooLargeError,
  TooManyRequestsError,
  UnsupportedMediaTypeError,
} from "../../shared/errors/index.js";
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
  ) {}

  /** Runs before the body is read: consent, concurrency, declared size, type, plan quota. */
  async admit(
    ownerId: string,
    contentLength: number,
    contentType: string | undefined,
  ): Promise<UploadSlot> {
    if (!(await this.consent.settings(ownerId)).telemetryConsent)
      throw new ForbiddenError("Telemetry consent required");
    if (this.activeUploads >= MAX_CONCURRENT_UPLOADS)
      throw new TooManyRequestsError("Upload concurrency reached");
    if (contentLength > (await this.limits.maxDemoBytes()))
      throw new PayloadTooLargeError("Demo upload exceeds size limit");
    if (contentType !== "application/octet-stream")
      throw new UnsupportedMediaTypeError("Use application/octet-stream");
    const reservation = await this.quota.reserveUpload(ownerId);
    this.activeUploads++;
    return new UploadSlot(ownerId, reservation, () => this.activeUploads--);
  }

  /** Streams the body into storage (content-type parser). Throws status errors. */
  async store(filename: unknown, body: Readable): Promise<NewDemoJob> {
    const name = uploadFilenameSchema.safeParse(filename);
    if (!name.success) throw bodyError(400, "Valid .dem filename required");
    const id = randomUUID();
    const objectKey = id + ".dem";
    try {
      const stored = await this.storage.write(
        objectKey,
        body,
        await this.limits.maxDemoBytes(),
      );
      if (!stored.size) {
        await this.storage.remove(objectKey);
        throw bodyError(400, "Empty demo upload");
      }
      return { id, filename: name.data, objectKey, ...stored };
    } catch (error) {
      if (error instanceof ObjectTooLargeError)
        throw bodyError(413, "Demo upload exceeds size limit");
      throw error;
    }
  }

  /** Queues the stored file; on any failure removes it and returns the quota unit. */
  async enqueue(slot: UploadSlot, file: NewDemoJob): Promise<QueuedJobDto> {
    try {
      return await this.matches.createJob(slot.ownerId, file);
    } catch {
      await this.storage.remove(file.objectKey);
      await slot.releaseQuota();
      throw new TooManyRequestsError(
        "Upload quota reached or consent withdrawn",
      );
    }
  }
}
