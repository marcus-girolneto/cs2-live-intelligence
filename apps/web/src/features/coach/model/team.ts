/** View model for the team review (IGL view of the whole team). Defensive like coaching.ts. */
import { parseClip, type ClipRef } from "@/features/replay";
import { finite, prose as text } from "@/shared/format";

export const TEAM_DIMENSIONS = [
  "trading",
  "utility",
  "opening",
  "economy",
  "conversion",
] as const;
export type TeamDimension = (typeof TEAM_DIMENSIONS)[number];
export type TeamScore = {
  key: TeamDimension;
  value: number;
  label: string | null;
  basis: string | null;
};
export type TeamPoint = { text: string; evidenceIds: string[] };
export type TeamRole = {
  steamId: string;
  role: string;
  strengths: TeamPoint[];
  fixes: TeamPoint[];
};
export type TeamPattern = {
  text: string;
  map: string | null;
  confidence: "low" | "medium" | "high" | null;
  clips: ClipRef[];
};
export type TeamKeyRound = {
  round: number;
  title: string;
  whatHappened: string | null;
  whatToDoInstead: string | null;
  clip: ClipRef | null;
};
export type TeamPlanItem = { text: string; owner: string };
export type TeamReview = {
  verdict: string | null;
  members: string[];
  scores: TeamScore[];
  roles: TeamRole[];
  patterns: TeamPattern[];
  keyRounds: TeamKeyRound[];
  plan: TeamPlanItem[];
  caveats: string[];
};
export type StoredTeamReview = {
  id: string;
  createdAt: string;
  review: TeamReview;
  fresh?: boolean;
};

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const strs = (v: unknown) =>
  arr(v)
    .map(text)
    .filter((x): x is string => !!x);
const points = (v: unknown): TeamPoint[] =>
  arr(v).flatMap((p) => {
    const o = obj(p);
    const t = typeof p === "string" ? text(p) : text(o.text);
    return t ? [{ text: t, evidenceIds: strs(o.evidenceIds) }] : [];
  });
const clipOf = (v: unknown): ClipRef | null =>
  v ? (parseClip(v) ?? null) : null;

/** Normalizes a team review; null when it has nothing to show. */
export function normalizeTeamReview(raw: unknown): TeamReview | null {
  const o = obj(raw);
  const scoresRaw = obj(o.teamScores);
  const scores = TEAM_DIMENSIONS.flatMap((key) => {
    const s = scoresRaw[key];
    const so = obj(s);
    const value = finite(typeof s === "number" ? s : so.value);
    if (value === null) return [];
    return [
      {
        key,
        value: Math.max(0, Math.min(100, Math.round(value))),
        label: text(so.label),
        basis: text(so.basis),
      },
    ];
  });
  const roles = arr(o.roles).flatMap((r) => {
    const ro = obj(r);
    const steamId = text(ro.steamId);
    if (!steamId) return [];
    return [
      {
        steamId,
        role: text(ro.role) ?? "flex",
        strengths: points(ro.strengths),
        fixes: points(ro.fixes),
      },
    ];
  });
  const patterns = arr(o.patterns).flatMap((p) => {
    const po = obj(p);
    const t = text(po.text);
    if (!t) return [];
    const c = po.confidence;
    return [
      {
        text: t,
        map: text(po.map),
        confidence:
          c === "low" || c === "medium" || c === "high"
            ? (c as TeamPattern["confidence"])
            : null,
        clips: arr(po.clips)
          .map(parseClip)
          .filter((x): x is ClipRef => !!x),
      },
    ];
  });
  const keyRounds = arr(o.keyRounds).flatMap((k) => {
    const ko = obj(k);
    const round = finite(ko.round);
    const title = text(ko.title);
    if (round === null || !title) return [];
    return [
      {
        round,
        title,
        whatHappened: text(ko.whatHappened),
        whatToDoInstead: text(ko.whatToDoInstead),
        clip: clipOf(ko.clip),
      },
    ];
  });
  const plan = arr(o.plan).flatMap((p) => {
    const po = obj(p);
    const t = text(po.text);
    return t ? [{ text: t, owner: text(po.owner) ?? "team" }] : [];
  });
  const verdict = text(o.verdict);
  if (!verdict && !scores.length && !roles.length && !plan.length) return null;
  return {
    verdict,
    members: strs(o.members),
    scores,
    roles,
    patterns,
    keyRounds,
    plan,
    caveats: strs(o.caveats),
  };
}

/** GET team-reviews → newest first. */
export function normalizeTeamReviews(raw: unknown): StoredTeamReview[] {
  return arr(obj(raw).reviews)
    .flatMap((r) => {
      const ro = obj(r);
      const id = text(ro.reviewId) ?? text(ro.id);
      const review = normalizeTeamReview(ro.teamReview ?? ro.review);
      if (!id || !review) return [];
      return [{ id, createdAt: text(ro.createdAt) ?? "", review }];
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export const ROLE_LABEL: Record<string, string> = {
  entry: "Entry",
  support: "Support",
  lurker: "Lurker",
  awper: "AWPer",
  anchor: "Anchor",
  flex: "Flex",
};
export const DIMENSION_LABEL: Record<TeamDimension, string> = {
  trading: "Trading",
  utility: "Utility",
  opening: "Openings",
  economy: "Economy",
  conversion: "Converting advantages",
};
