/**
 * Plain-language readings of the numbers ("what this means for you"). Deterministic: every
 * sentence comes from the metrics, no AI. Returns EN source strings + params for t().
 */
import type { BodyRegion } from "./insight/index";

export type Line = { text: string; params?: Record<string, string | number> };
export type Verdict = "above" | "below" | "about";

/** Above / below / about the lobby (±10 % relative band). */
export function compareToLobby(
  value: number | null,
  lobby: number | null,
  lowerIsBetter = false,
): Verdict | null {
  if (value === null || lobby === null || lobby === 0) return null;
  const r = value / lobby;
  if (r > 0.9 && r < 1.1) return "about";
  const higher = r >= 1.1;
  return higher !== lowerIsBetter ? "above" : "below";
}

const r0 = (v: number) => Math.round(v);

export type OverviewInput = {
  adr: number | null;
  adrRef: number | null;
  deaths: number | null;
  tradedPct: number | null;
  openingWon: number | null;
  openingLost: number | null;
};
export function overviewLines(x: OverviewInput): Line[] {
  const lines: Line[] = [];
  const v = compareToLobby(x.adr, x.adrRef);
  if (x.adr !== null && x.adrRef !== null && v)
    lines.push({
      text:
        v === "above"
          ? "You dealt {adr} damage per round, more than the lobby average ({avg})."
          : v === "below"
            ? "You dealt {adr} damage per round, less than the lobby average ({avg})."
            : "You dealt {adr} damage per round, about the lobby average ({avg}).",
      params: { adr: r0(x.adr), avg: r0(x.adrRef) },
    });
  if (x.deaths && x.deaths > 0 && x.tradedPct !== null) {
    const untraded = Math.round(x.deaths * (1 - x.tradedPct / 100));
    lines.push(
      untraded * 2 >= x.deaths
        ? {
            text: "{n} of your {d} deaths weren't traded. You were often fighting alone.",
            params: { n: untraded, d: x.deaths },
          }
        : {
            text: "Most of your deaths were traded. Good spacing with your team.",
          },
    );
  }
  if (x.openingWon !== null && x.openingLost !== null) {
    const n = x.openingWon + x.openingLost;
    if (n > 0)
      lines.push({
        text: "You won {w} of {n} opening duels (the first fight of a round).",
        params: { w: x.openingWon, n },
      });
  }
  return lines;
}

export const REGION_LABEL: Record<BodyRegion, string> = {
  head: "head",
  chest: "chest",
  stomach: "stomach",
  arms: "arms",
  legs: "legs",
};

export type AimInput = {
  accuracy: number | null;
  accuracyRef: number | null;
  headShare: number | null;
  headRef: number | null;
  hitgroups: Record<BodyRegion, number> | null;
};
export function aimLines(x: AimInput): Line[] {
  const lines: Line[] = [];
  if (x.accuracy !== null && x.accuracyRef !== null && x.accuracyRef > 0) {
    const r = x.accuracy / x.accuracyRef;
    const p = { acc: r0(x.accuracy), ref: r0(x.accuracyRef) };
    lines.push({
      text:
        r >= 1.8
          ? "You hit {acc}% of your shots, about twice the lobby's rate ({ref}%)."
          : r <= 0.6
            ? "You hit {acc}% of your shots, about half the lobby's rate ({ref}%)."
            : r >= 1.1
              ? "You hit {acc}% of your shots, better than the lobby ({ref}%)."
              : r <= 0.9
                ? "You hit {acc}% of your shots, worse than the lobby ({ref}%)."
                : "You hit {acc}% of your shots, about the same as the lobby ({ref}%).",
      params: p,
    });
  }
  if (x.headShare !== null && x.hitgroups) {
    const groups = x.hitgroups;
    const body = (Object.keys(groups) as BodyRegion[])
      .filter((k) => k !== "head")
      .sort((a, b) => groups[b] - groups[a])[0];
    const low = x.headRef !== null ? x.headShare < x.headRef * 0.9 : false;
    if (low && body)
      lines.push({
        text: "Only {h}% of your hits landed on the head (lobby {r}%). Most landed in the {part}: aim a little higher.",
        params: {
          h: r0(x.headShare),
          r: r0(x.headRef!),
          part: REGION_LABEL[body],
        },
      });
    else if (x.headRef !== null)
      lines.push({
        text: "{h}% of your hits landed on the head (lobby {r}%). Your crosshair height is fine.",
        params: { h: r0(x.headShare), r: r0(x.headRef) },
      });
  }
  return lines;
}

export type PlaceInput = { place: string; kills: number; deaths: number };
export function mapLines(
  best: PlaceInput | undefined,
  worst: PlaceInput | undefined,
): Line[] {
  const lines: Line[] = [];
  if (best && best.kills > best.deaths)
    lines.push({
      text: "You were strongest at {place} ({k} kills, {d} deaths).",
      params: { place: best.place, k: best.kills, d: best.deaths },
    });
  if (worst && worst.deaths > worst.kills && worst.place !== best?.place)
    lines.push({
      text: "You died most at {place} ({d} deaths, {k} kills). Try a different angle or wait for help there.",
      params: { place: worst.place, k: worst.kills, d: worst.deaths },
    });
  return lines;
}

export type RoundInput = {
  round: number;
  won?: boolean | undefined;
  damage: number;
  kills: number;
  died?: boolean | undefined;
  traded?: boolean | undefined;
};
export function roundLines(rows: RoundInput[]): Line[] {
  const lines: Line[] = [];
  const known = rows.filter((r) => r.won !== undefined);
  if (known.length)
    lines.push({
      text: "Your team won {w} of {n} rounds you played.",
      params: { w: known.filter((r) => r.won).length, n: known.length },
    });
  const best = [...rows].sort((a, b) => b.damage - a.damage)[0];
  if (best && best.damage > 0)
    lines.push({
      text: "Your best round was round {r}: {dmg} damage and {k} kill(s).",
      params: { r: best.round, dmg: best.damage, k: best.kills },
    });
  const alone = rows.filter((r) => r.died && r.traded === false);
  if (alone.length)
    lines.push({
      text: "You died without a trade in rounds {list}. Open them below to see why.",
      params: { list: alone.map((r) => r.round).join(", ") },
    });
  return lines;
}
