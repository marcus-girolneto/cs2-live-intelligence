import type { MatchDto } from "@/shared/api-types";
import { text } from "@/shared/format";
import type { MatchSummary } from "./status";

export type OwnershipKind = "mine" | "external";
export type Ownership = {
  jobId: string;
  /** null while unknown (we could not tell whether you played in it). */
  ownership: OwnershipKind | null;
  playerSteamId: string | null;
  playerName: string | null;
  matchedBy: "steam" | "chosen" | null;
};
export type AutoReviewStatus =
  "queued" | "running" | "done" | "skipped" | "failed";
export type AutoReview = {
  jobId: string;
  status: AutoReviewStatus;
  reason: string | null;
  reviewId: string | null;
};

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const items = (raw: unknown) => {
  const list = obj(raw).items;
  return Array.isArray(list) ? list.map(obj) : [];
};

/** GET matches/ownership → one entry per job id. */
export function normalizeOwnership(raw: unknown): Map<string, Ownership> {
  const out = new Map<string, Ownership>();
  for (const o of items(raw)) {
    const jobId = text(o.jobId);
    if (!jobId) continue;
    const kind = o.ownership;
    const by = o.matchedBy;
    out.set(jobId, {
      jobId,
      ownership: kind === "mine" || kind === "external" ? kind : null,
      playerSteamId: text(o.playerSteamId),
      playerName: text(o.playerName),
      matchedBy: by === "steam" || by === "chosen" ? by : null,
    });
  }
  return out;
}

const AUTO: AutoReviewStatus[] = [
  "queued",
  "running",
  "done",
  "skipped",
  "failed",
];
/** GET matches/auto-reviews → one entry per job id ("ready" = done with a review). */
export function normalizeAutoReviews(raw: unknown): Map<string, AutoReview> {
  const out = new Map<string, AutoReview>();
  for (const o of items(raw)) {
    const jobId = text(o.jobId);
    const status = AUTO.find((s) => s === o.status);
    if (!jobId || !status) continue;
    out.set(jobId, {
      jobId,
      status,
      reason: text(o.reason),
      reviewId: text(o.reviewId),
    });
  }
  return out;
}

/** A plain label for an auto-review state (null = show nothing). */
export function autoReviewLabel(a: AutoReview | undefined): {
  text: string;
  tone: "good" | "warn" | "muted";
} | null {
  if (!a) return null;
  if (a.status === "done" && a.reviewId)
    return { text: "AI review ready", tone: "good" };
  if (a.status === "queued" || a.status === "running")
    return { text: "AI review in progress", tone: "muted" };
  if (a.reason === "insufficient_credits" || a.reason === "not_enough_credits")
    return { text: "Not enough credits", tone: "warn" };
  if (a.reason === "player_not_found" || a.reason === "not_in_demo")
    return { text: "You're not in this demo", tone: "muted" };
  if (a.status === "failed") return { text: "AI review failed", tone: "warn" };
  return null;
}

export type OwnerTab = "all" | "mine" | "external";
export type Period = "all" | "7d" | "30d";
export type MatchFilter = { tab: OwnerTab; map: string | null; period: Period };

const DAY = 86_400_000;
/** Applies the owner tab, map and date filters; also returns the per-tab counts. */
export function filterMatches(
  matches: MatchDto[],
  owners: Map<string, Ownership>,
  summaries: Map<string, MatchSummary>,
  filter: MatchFilter,
  now: number,
) {
  const kind = (m: MatchDto) => owners.get(m.id)?.ownership ?? null;
  const base = matches.filter((m) => {
    if (filter.map) {
      const map = summaries.get(m.analysisId ?? m.id)?.map ?? null;
      if (map !== filter.map) return false;
    }
    if (filter.period !== "all") {
      const days = filter.period === "7d" ? 7 : 30;
      const at = Date.parse(m.createdAt);
      if (!Number.isFinite(at) || now - at > days * DAY) return false;
    }
    return true;
  });
  const counts = {
    all: base.length,
    // Unknown demos count as yours until you say otherwise.
    mine: base.filter((m) => kind(m) !== "external").length,
    external: base.filter((m) => kind(m) === "external").length,
  };
  const list =
    filter.tab === "all"
      ? base
      : base.filter((m) =>
          filter.tab === "external"
            ? kind(m) === "external"
            : kind(m) !== "external",
        );
  return { list, counts };
}

/** Mine first (newest first inside each group), external demos after. */
export function mineFirst(matches: MatchDto[], owners: Map<string, Ownership>) {
  const ext = (m: MatchDto) =>
    owners.get(m.id)?.ownership === "external" ? 1 : 0;
  return [...matches].sort(
    (a, b) =>
      ext(a) - ext(b) || Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}
