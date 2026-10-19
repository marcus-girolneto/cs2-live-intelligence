/** A demo job (GET /v1/matches, GET /v1/matches/:id). */
export type MatchDto = {
  id: string;
  filename: string;
  status: "queued" | "processing" | "complete" | "failed" | (string & {});
  createdAt: string;
  error?: string;
  /** Present once status is "complete". */
  analysisId?: string;
};
export type MatchListDto = { matches: MatchDto[] };
/** 202 body of POST /v1/demos/uploads and POST /v1/demos/sample. */
export type QueuedJobDto = { id: string; status: "queued" };
export type SampleAvailabilityDto = { available: boolean };
/** GET /v1/analyses/:id (analysis and coaching follow analysisSchema/coachingSchema). */
export type StoredAnalysisDto = {
  id: string;
  analysis: unknown;
  coaching: unknown;
};
