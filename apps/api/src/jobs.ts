import type { FastifyInstance, FastifyRequest } from "fastify";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, rm, readdir, stat } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { resolve } from "node:path";
import { Transform, type Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { execFile } from "node:child_process";
import { normalizedDemoSchema, feedbackSchema } from "@cs2/contracts";
import { analyzeDemo } from "@cs2/analytics";
import { generateCoaching } from "@cs2/coaching";
import type { PgRepository } from "./repository.js";
export interface JobOptions {
  storageDir: string;
  parserBin: string;
  maxUploadBytes?: number;
  workerIntervalMs?: number;
  parserTimeoutMs?: number;
  disableWorker?: boolean;
}
interface Uploaded {
  id: string;
  filename: string;
  objectKey: string;
  checksum: string;
  size: number;
}
interface UploadRequest extends FastifyRequest {
  uploadOwner?: string;
  uploadActive?: boolean;
}
export function objectPath(directory: string, key: string) {
  if (!/^[a-f0-9-]{36}\.dem$/.test(key)) throw new Error("Invalid object key");
  return resolve(directory, key);
}
export function parseFile(
  binary: string,
  path: string,
  timeoutMs = 120000,
): Promise<unknown> {
  return new Promise((resolveResult, reject) => {
    execFile(
      binary,
      ["-input", path],
      {
        timeout: timeoutMs,
        maxBuffer: 16 * 1024 * 1024,
        encoding: "utf8",
        killSignal: "SIGKILL",
        env: { PATH: process.env.PATH ?? "/usr/bin:/bin" },
      },
      (error, stdout) => {
        if (error) {
          reject(
            new Error(
              error.killed
                ? "Demo parser deadline exceeded"
                : "Demo parser rejected input or exceeded output limit",
            ),
          );
          return;
        }
        try {
          resolveResult(JSON.parse(stdout));
        } catch {
          reject(new Error("Demo parser returned invalid JSON"));
        }
      },
    );
  });
}
export async function createWorker(repo: PgRepository, options: JobOptions) {
  await mkdir(options.storageDir, { recursive: true, mode: 0o700 });
  const counters = { complete: 0, failed: 0, errors: 0 };
  let running = false;
  let stopped = false;
  let current: Promise<void> | undefined;
  async function execute() {
    running = true;
    try {
      const job = await repo.claimJob();
      if (!job) return;
      try {
        const input = normalizedDemoSchema.parse(
          await parseFile(
            options.parserBin,
            objectPath(options.storageDir, job.objectKey),
            options.parserTimeoutMs,
          ),
        );
        if (!(await repo.settings(job.ownerId)).telemetryConsent)
          throw new Error("Consent withdrawn");
        const analysis = analyzeDemo(input);
        const providerEnabled = !!process.env.OPENAI_API_KEY;
        const allowed = providerEnabled
          ? await repo.reserveProvider(job.ownerId)
          : false;
        const coaching = await generateCoaching(analysis, {
          apiKey: allowed ? process.env.OPENAI_API_KEY : "",
          maxAttempts: 2,
          maxOutputTokens: 768,
          timeoutMs: 15000,
        });
        if (providerEnabled && !allowed)
          coaching.caveats.push(
            "Daily provider quota reached; offline feedback was generated.",
          );
        await repo.finishJob(job.id, job.leaseToken, { analysis, coaching });
        counters.complete++;
      } catch (error) {
        const message =
          error instanceof Error &&
          /^(Demo parser|Invalid object key)/.test(error.message)
            ? error.message
            : "Demo analysis failed contract validation or coaching generation";
        await repo.finishJob(job.id, job.leaseToken, { error: message });
        counters.failed++;
      }
    } catch {
      counters.errors++;
    } finally {
      running = false;
    }
  }
  function runOnce(): Promise<void> {
    if (running || stopped) return current ?? Promise.resolve();
    current = execute();
    return current;
  }
  async function cleanup() {
    await repo.retain();
    for (const key of await repo.pendingDeletions()) {
      await rm(objectPath(options.storageDir, key), { force: true });
      await repo.deletedFile(key);
    }
    // Crash between filesystem upload and DB insert cannot leave an object forever.
    const known = await repo.knownObjects();
    for (const key of await readdir(options.storageDir)) {
      if (!/^[a-f0-9-]{36}\.dem$/.test(key) || known.has(key)) continue;
      const path = objectPath(options.storageDir, key);
      if (Date.now() - (await stat(path)).mtimeMs > 3600000)
        await rm(path, { force: true });
    }
  }
  const interval = options.disableWorker
    ? undefined
    : setInterval(() => {
        void runOnce();
      }, options.workerIntervalMs ?? 1000);
  interval?.unref();
  const retention = options.disableWorker
    ? undefined
    : setInterval(() => {
        void cleanup().catch(() => {
          counters.errors++;
        });
      }, 3600000);
  retention?.unref();
  if (!options.disableWorker) {
    await cleanup();
    void runOnce();
  }
  return {
    runOnce,
    cleanup,
    counters,
    async stop() {
      stopped = true;
      if (interval) clearInterval(interval);
      if (retention) clearInterval(retention);
      await current;
    },
  };
}
export async function registerJobs(
  app: FastifyInstance,
  repo: PgRepository,
  options: JobOptions,
) {
  const maxBytes = options.maxUploadBytes ?? 64 * 1024 * 1024;
  if (
    !Number.isInteger(maxBytes) ||
    maxBytes < 1 ||
    maxBytes > 128 * 1024 * 1024
  )
    throw new Error("Upload cap must be 1 byte..128 MiB");
  const worker = await createWorker(repo, options);
  let activeUploads = 0;
  const owner = async (request: FastifyRequest) => {
    const token = request.headers.authorization?.startsWith("Bearer ")
      ? request.headers.authorization.slice(7)
      : "";
    return token ? repo.owner(token) : undefined;
  };
  app.addContentTypeParser(
    "application/octet-stream",
    async (request: FastifyRequest, payload: Readable) => {
      const upload = request as UploadRequest;
      if (!upload.uploadOwner)
        throw Object.assign(new Error("Unauthorized upload"), {
          statusCode: 401,
        });
      const filename = request.headers["x-filename"];
      if (
        typeof filename !== "string" ||
        !/^[a-zA-Z0-9 _().-]{1,124}\.dem$/i.test(filename) ||
        filename.includes("..")
      )
        throw Object.assign(new Error("Valid .dem filename required"), {
          statusCode: 400,
        });
      const id = randomUUID();
      const objectKey = id + ".dem";
      const path = objectPath(options.storageDir, objectKey);
      let size = 0;
      const hash = createHash("sha256");
      try {
        await pipeline(
          payload,
          new Transform({
            transform(chunk: Buffer, _encoding, callback) {
              size += chunk.length;
              if (size > maxBytes) {
                callback(
                  Object.assign(new Error("Demo upload exceeds size limit"), {
                    statusCode: 413,
                  }),
                );
                return;
              }
              hash.update(chunk);
              callback(null, chunk);
            },
          }),
          createWriteStream(path, { flags: "wx", mode: 0o600 }),
        );
        if (!size)
          throw Object.assign(new Error("Empty demo upload"), {
            statusCode: 400,
          });
        return {
          id,
          filename,
          objectKey,
          size,
          checksum: hash.digest("hex"),
        } satisfies Uploaded;
      } catch (error) {
        await rm(path, { force: true });
        throw error;
      }
    },
  );
  app.post(
    "/v1/demos/uploads",
    {
      bodyLimit: maxBytes,
      onRequest: async (request, reply) => {
        const id = await owner(request);
        if (!id) return reply.code(401).send({ error: "Unauthorized" });
        if (!(await repo.settings(id)).telemetryConsent)
          return reply.code(403).send({ error: "Telemetry consent required" });
        if (activeUploads >= 4)
          return reply.code(429).send({ error: "Upload concurrency reached" });
        const length = Number(request.headers["content-length"] ?? 0);
        if (length > maxBytes)
          return reply
            .code(413)
            .send({ error: "Demo upload exceeds size limit" });
        if (request.headers["content-type"] !== "application/octet-stream")
          return reply
            .code(415)
            .send({ error: "Use application/octet-stream" });
        activeUploads++;
        (request as UploadRequest).uploadActive = true;
        (request as UploadRequest).uploadOwner = id;
      },
      onResponse: async (request) => {
        if ((request as UploadRequest).uploadActive) {
          activeUploads--;
          (request as UploadRequest).uploadActive = false;
        }
      },
    },
    async (request, reply) => {
      const file = request.body as Uploaded;
      try {
        return reply
          .code(202)
          .send(
            await repo.createJob((request as UploadRequest).uploadOwner!, file),
          );
      } catch {
        await rm(objectPath(options.storageDir, file.objectKey), {
          force: true,
        });
        return reply
          .code(429)
          .send({ error: "Upload quota reached or consent withdrawn" });
      }
    },
  );
  app.get("/v1/matches", async (request, reply) => {
    const id = await owner(request);
    if (!id) return reply.code(401).send({ error: "Unauthorized" });
    return repo.matches(id);
  });
  app.get<{ Params: { id: string } }>(
    "/v1/matches/:id",
    async (request, reply) => {
      const id = await owner(request);
      if (!id) return reply.code(401).send({ error: "Unauthorized" });
      return (
        (await repo.match(id, request.params.id)) ??
        reply.code(404).send({ error: "Match not found" })
      );
    },
  );
  app.get<{ Params: { id: string } }>(
    "/v1/analyses/:id",
    async (request, reply) => {
      const id = await owner(request);
      if (!id) return reply.code(401).send({ error: "Unauthorized" });
      return (
        (await repo.analysis(id, request.params.id)) ??
        reply.code(404).send({ error: "Analysis not found" })
      );
    },
  );
  app.post("/v1/feedback", async (request, reply) => {
    const id = await owner(request);
    if (!id) return reply.code(401).send({ error: "Unauthorized" });
    const body = feedbackSchema.safeParse(request.body);
    if (!body.success)
      return reply.code(400).send({ error: "Invalid feedback" });
    const result = await repo.feedback(id, body.data.rating, body.data.comment);
    return result
      ? reply.code(201).send(result)
      : reply.code(403).send({
          error: "Analytics consent required or feedback quota reached",
        });
  });
  app.post("/v1/events", async (request, reply) => {
    const id = await owner(request);
    if (!id) return reply.code(401).send({ error: "Unauthorized" });
    const body = request.body as {
      name?: unknown;
      properties?: unknown;
    } | null;
    if (
      !body ||
      typeof body.name !== "string" ||
      !/^[a-z][a-z0-9_]{0,63}$/.test(body.name)
    )
      return reply.code(400).send({ error: "Invalid event" });
    const properties = body.properties ?? {};
    if (
      typeof properties !== "object" ||
      properties === null ||
      Array.isArray(properties) ||
      Object.keys(properties).length > 10 ||
      Object.entries(properties).some(
        ([key, value]) =>
          !/^[a-z][a-z0-9_]{0,31}$/.test(key) ||
          (value !== null &&
            !["string", "number", "boolean"].includes(typeof value)),
      ) ||
      JSON.stringify(properties).length > 2048
    )
      return reply.code(400).send({ error: "Invalid event properties" });
    if (
      !(await repo.productEvent(
        id,
        body.name,
        properties as Record<string, string | number | boolean | null>,
      ))
    )
      return reply.code(403).send({
        error: "Analytics consent required or daily event quota reached",
      });
    return reply.code(202).send({ accepted: true });
  });
  app.addHook("onClose", async () => worker.stop());
  return worker;
}
