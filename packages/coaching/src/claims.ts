/**
 * Deterministic claim checks (no model): every number written in a human-readable claim must
 * match a value of a fact the claim cites (rounding to the decimals written, EN or PT decimal
 * separators), a number in that fact's description (numerator, denominator, sample size), a
 * percentage of two of those numbers, a round or count derivable from the cited events, or a
 * small count / game constant. "Consecutive" claims ("in a row", "seguidos") must match a real
 * run of consecutive rounds among the cited ones.
 */

export type ClaimFact = {
  value?: number;
  n?: number;
  description?: string;
  eventIds?: string[];
};
export type Claim = {
  /** Stable key the caller uses to apply the outcome. */
  key: string;
  text: string;
  /** Facts the claim cites (or the facts in scope for summaries/verdicts). */
  factIds: string[];
  /** Events the claim is about (key moments, key rounds). */
  eventIds?: string[];
  /** Extra numbers the claim may state (e.g. a key moment's HP, time, distance, situation). */
  extraNumbers?: number[];
  /** Extra rounds the claim may name. */
  extraRounds?: number[];
};
export type ClaimContext = {
  facts: Map<string, ClaimFact>;
  /** Round of each event id. */
  eventRounds: Map<string, number>;
  /** Rounds in the match (named rounds must exist when no cited round is known). */
  totalRounds?: number;
};
export type CheckResult = {
  ok: boolean;
  /** Numbers that matched nothing. */
  unmatched: number[];
  /** Named rounds outside the cited ones. */
  badRounds: number[];
  /** A "consecutive" claim that the cited rounds do not support. */
  consecutive: boolean;
};

/** Always allowed: tiny counts and the app's fixed windows (5 s trade window, 20 s early death). */
export const FREE_NUMBERS = new Set([0, 1, 2, 5, 20]);

const NUMBER =
  /(?<![\p{L}\d.,-])(\d{1,3}(?:[.,]\d{3})+(?![.,]?\d)|\d+(?:[.,]\d+)?)(?![\p{L}\d])/gu;
const SITUATION = /\b\d\s?(?:v|x|vs)\s?\d\b/gi;
const ROUND_REF =
  /\b(?:rounds?|rodadas?|r)\s*#?\s*(\d{1,3}(?:\s*(?:,|e|and|a|to|-|–|até)\s*\d{1,3})*)/gi;
const CONSECUTIVE =
  /\b(?:consecutive|in a row|back[- ]to[- ]back|straight rounds|seguid[oa]s|consecutiv[oa]s|em sequ[eê]ncia|na sequ[eê]ncia)\b/i;

/** Parses a number token with EN or PT separators. */
export function parseNumber(token: string): number {
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(token) && !/^\d+[.,]\d{1,2}$/.test(token))
    return Number(token.replace(/[.,]/g, ""));
  return Number(token.replace(",", "."));
}
const decimals = (token: string) => {
  const m = /[.,](\d+)$/.exec(token);
  return m && !/^\d{1,3}(?:[.,]\d{3})+$/.test(token) ? m[1]!.length : 0;
};

/** Numbers written in a text (situations like "2v4", callout/weapon tokens like "AK-47" excluded). */
export function numbersIn(text: string): { value: number; decimals: number }[] {
  const cleaned = text.replace(SITUATION, " ");
  return [...cleaned.matchAll(NUMBER)].map((m) => ({
    value: parseNumber(m[1]!),
    decimals: decimals(m[1]!),
  }));
}

/** Round numbers a text names ("round 7", "rodadas 3, 4 e 5", "R12"). */
export function roundsIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(ROUND_REF)) {
    const nums = (m[1] ?? "").match(/\d{1,3}/g) ?? [];
    const range = /\d\s*(?:a|to|-|–|até)\s*\d/.test(m[1] ?? "");
    if (range && nums.length === 2) {
      const [a, b] = nums.map(Number) as [number, number];
      for (let r = Math.min(a, b); r <= Math.max(a, b) && r - a < 40; r++)
        out.push(r);
    } else out.push(...nums.map(Number));
  }
  return out;
}

const matches = (x: { value: number; decimals: number }, v: number) => {
  const tolerance = 0.5 * 10 ** -x.decimals + 1e-9;
  return (
    Math.abs(x.value - v) <= tolerance ||
    // A rate written as a percentage (0.63 → 63%) or the reverse.
    Math.abs(x.value - v * 100) <= tolerance ||
    (x.decimals === 0 && Math.abs(x.value - Math.round(v)) < 1e-9)
  );
};

/** Longest run of consecutive round numbers. */
export function longestRun(rounds: Iterable<number>): number {
  const sorted = [...new Set(rounds)].sort((a, b) => a - b);
  let best = sorted.length ? 1 : 0;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    run = sorted[i] === sorted[i - 1]! + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}

/** The deterministic checks for one claim. */
export function checkClaim(claim: Claim, ctx: ClaimContext): CheckResult {
  const allowed: number[] = [...(claim.extraNumbers ?? [])];
  const rounds = new Set<number>(claim.extraRounds ?? []);
  const eventIds = new Set(claim.eventIds ?? []);
  for (const id of claim.factIds) {
    const f = ctx.facts.get(id);
    if (!f) continue;
    if (f.value !== undefined) allowed.push(f.value);
    if (f.n !== undefined) allowed.push(f.n);
    const nums = numbersIn(f.description ?? "").map((x) => x.value);
    allowed.push(...nums);
    for (const a of nums)
      for (const b of nums) if (b > 0 && a <= b) allowed.push((100 * a) / b);
    for (const e of f.eventIds ?? []) eventIds.add(e);
  }
  for (const e of eventIds) {
    const r = ctx.eventRounds.get(e);
    if (r !== undefined) rounds.add(r);
  }
  allowed.push(eventIds.size, rounds.size, ...rounds);
  const named = roundsIn(claim.text);
  const badRounds = rounds.size
    ? named.filter((r) => !rounds.has(r))
    : named.filter((r) => r < 1 || (ctx.totalRounds ?? 1000) < r);
  const unmatched = numbersIn(claim.text)
    .filter(
      (x) =>
        !(x.decimals === 0 && FREE_NUMBERS.has(x.value)) &&
        !named.includes(x.value) &&
        !allowed.some((v) => matches(x, v)),
    )
    .map((x) => x.value);
  let consecutive = false;
  if (CONSECUTIVE.test(claim.text)) {
    const pool = named.length >= 2 ? named : [...rounds];
    const claimed = numbersIn(claim.text)
      .filter((x) => x.decimals === 0 && x.value >= 2 && x.value <= 30)
      .map((x) => x.value)
      .filter((v) => !named.includes(v));
    const need = Math.max(
      2,
      claimed[0] ?? (named.length >= 2 ? named.length : 2),
    );
    consecutive = longestRun(pool) < need;
  }
  return {
    ok: !unmatched.length && !badRounds.length && !consecutive,
    unmatched,
    badRounds,
    consecutive,
  };
}

/** Removes the "consecutive" wording (the deterministic fix when the run is not real). */
export function withoutConsecutive(text: string): string {
  return text
    .replace(new RegExp(CONSECUTIVE.source, "gi"), "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}
