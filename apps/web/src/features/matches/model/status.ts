export const PENDING = ["queued", "processing", "running", "uploaded"];
export const STATUS: Record<string, string> = {
  complete: "Ready",
  failed: "Failed",
  queued: "Queued",
  uploaded: "Queued",
  processing: "Processing",
  running: "Processing",
};

export type MatchSummary = {
  map?: string | null;
  adr?: number | null;
  kills?: number | null;
  deaths?: number | null;
};
