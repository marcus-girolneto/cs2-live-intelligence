import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { Readable } from "node:stream";
import type { ObjectStorage } from "../../infrastructure/storage/object-storage.js";
import {
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
} from "../../shared/errors/index.js";
import type { ConsentLookup } from "../privacy/privacy.repository.js";
import type { QueuedJobDto, SampleAvailabilityDto } from "./matches.dto.js";
import type { MatchesRepository } from "./matches.repository.js";
import type { UploadQuota } from "./upload.service.js";

/** Port: the operator-provided public sample demo (SAMPLE_DEMO_FILE). */
export interface SampleDemoSource {
  configured(): boolean;
  /** True when the configured path is a regular file. */
  available(): Promise<boolean>;
  /** Opens the file when it is a regular file of at most `maxBytes`; throws otherwise. */
  open(maxBytes: number): Promise<Readable>;
}
/** Port (ai-config app settings): the admin switch for the sample demo. */
export interface SampleDemoSwitch {
  sampleDemoEnabled(): Promise<boolean>;
}

export class FileSampleDemoSource implements SampleDemoSource {
  constructor(private readonly path: () => string | undefined) {}
  configured(): boolean {
    return !!this.path();
  }
  async available(): Promise<boolean> {
    const file = this.path();
    try {
      return !!file && (await stat(file)).isFile();
    } catch {
      return false;
    }
  }
  async open(maxBytes: number): Promise<Readable> {
    const file = this.path();
    if (!file) throw new Error("No sample");
    const info = await stat(file);
    if (!info.isFile() || info.size > maxBytes)
      throw new Error("Invalid sample");
    return createReadStream(file);
  }
}

const SAMPLE_FILENAME = "sample-public-cs2.dem";

/**
 * Imports the public sample demo into the caller's account so a new Steam account can explore
 * the product before uploading its own match. Counts as an upload for plan quotas.
 */
export class SampleDemoService {
  constructor(
    private readonly source: SampleDemoSource,
    private readonly enabled: SampleDemoSwitch,
    private readonly matches: MatchesRepository,
    private readonly storage: ObjectStorage,
    private readonly consent: ConsentLookup,
    private readonly quota: UploadQuota,
    private readonly maxBytes: number,
  ) {}

  async availability(): Promise<SampleAvailabilityDto> {
    if (!(await this.enabled.sampleDemoEnabled())) return { available: false };
    return { available: await this.source.available() };
  }

  async import(ownerId: string): Promise<QueuedJobDto> {
    if (!this.source.configured() || !(await this.enabled.sampleDemoEnabled()))
      throw new NotFoundError("No sample demo is configured.");
    if (!(await this.consent.settings(ownerId)).telemetryConsent)
      throw new ForbiddenError("Telemetry consent required");
    const reserved = await this.quota.reserveUpload(ownerId);
    const id = randomUUID();
    const objectKey = id + ".dem";
    let stored;
    try {
      stored = await this.storage.write(
        objectKey,
        await this.source.open(this.maxBytes),
      );
    } catch {
      await this.storage.remove(objectKey);
      await reserved.release();
      throw new NotFoundError("The sample demo file is not available.");
    }
    try {
      return await this.matches.createJob(ownerId, {
        id,
        filename: SAMPLE_FILENAME,
        objectKey,
        ...stored,
      });
    } catch {
      await this.storage.remove(objectKey);
      await reserved.release();
      throw new TooManyRequestsError(
        "Upload quota reached or consent withdrawn",
      );
    }
  }
}
