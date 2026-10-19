import { z } from "zod";

/** A demo job as listed by GET /v1/matches and GET /v1/matches/:id. */
export type MatchDto = {
  id: string;
  filename: string;
  status: string;
  createdAt: string;
  error?: string;
  analysisId?: string;
};
export type MatchListDto = { matches: MatchDto[] };
/** 202 response of uploads and sample imports. */
export type QueuedJobDto = { id: string; status: "queued" };
export type SampleAvailabilityDto = { available: boolean };
export type ReprocessResultDto = { queued: number };
/** GET /v1/admin/analyses/reprocess/status (currentVersion null before the worker started). */
export type ReprocessStatusDto = {
  pending: number;
  done: number;
  failed: number;
  currentVersion: string | null;
};

/** Stored analysis document plus its offline coaching (both loosely typed JSON). */
export type StoredAnalysis = {
  id: string;
  analysis: unknown;
  coaching: unknown;
};
export type CompletedAnalysis = {
  id: string;
  filename: string;
  analysis: unknown;
  createdAt: string;
};
export type NewDemoJob = {
  id: string;
  filename: string;
  objectKey: string;
  checksum: string;
  size: number;
};

/** `X-Filename` of an upload: a plain .dem name, no path traversal. */
export const uploadFilenameSchema = z
  .string()
  .regex(/^[a-zA-Z0-9 _().-]{1,124}\.dem$/i)
  .refine((name) => !name.includes(".."));

/** POST /v1/admin/analyses/reprocess body: {} (every owner) or {ownerId}. */
export const reprocessRequestSchema = z
  .object({ ownerId: z.string().min(1).max(128).optional() })
  .strict();
export type ReprocessRequestDto = z.infer<typeof reprocessRequestSchema>;
