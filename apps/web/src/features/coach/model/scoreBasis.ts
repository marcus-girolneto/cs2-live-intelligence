import type { Formatters } from "@/shared/i18n";

type T = (text: string, vars?: Record<string, string | number>) => string;

/** Metric names inside the deterministic score basis (packages/coaching review.ts, team/facts.ts). */
export const SCORE_METRICS: Record<string, string> = {
  accuracy: "accuracy",
  hsHit: "headshot hit rate",
  hsKills: "headshot kills",
  survival: "survival",
  early: "early deaths per round",
  deathTime: "average death time",
  utilDmg: "utility damage per round",
  flashed: "enemies flashed per round",
  flashAssists: "flash assists per round",
  traded: "deaths traded",
  tradeKills: "trade kills per round",
  dmgPerEquip: "damage per $1000 of equipment",
  antiEco: "anti-eco rounds won",
  kast: "KAST",
  adr: "ADR",
  openings: "opening duels won",
  multi: "multi-kill rounds per round",
  chains: "flash-assist chains + coordinated throws per round",
  advantage: "man-advantage rounds won",
};
const KNOWN = new Set(Object.values(SCORE_METRICS));

const PLAYER = /^(.+?) (-?[\d.]+)(%| s)? \(lobby (-?[\d.]+)(%| s)?\)$/;
const VERSUS = /^(.+?) (-?[\d.]+)(%)? vs enemy (-?[\d.]+)(%)?$/;
const OPENINGS = /^opening duels won (\d+) of (\d+)$/;
const UNDERDOG =
  /^rounds won while bought below the enemy (\d+)\/(\d+) vs enemy (\d+)\/(\d+)$/;

/** The score "basis" in the reader's language, with numbers in the locale's style. */
export function scoreBasisText(basis: string, t: T, fmt: Formatters): string {
  const num = (v: string, unit?: string) => {
    const n = fmt.number(Number(v), 2);
    return unit === "%" ? `${n}%` : unit === " s" ? `${n} s` : n;
  };
  return basis
    .split("; ")
    .map((part) => {
      let m = PLAYER.exec(part);
      if (m && KNOWN.has(m[1]!))
        return t("{metric} {value} (lobby {lobby})", {
          metric: t(m[1]!),
          value: num(m[2]!, m[3]),
          lobby: num(m[4]!, m[5]),
        });
      m = VERSUS.exec(part);
      if (m && KNOWN.has(m[1]!))
        return t("{metric} {value} vs enemy {enemy}", {
          metric: t(m[1]!),
          value: num(m[2]!, m[3]),
          enemy: num(m[4]!, m[5]),
        });
      m = OPENINGS.exec(part);
      if (m) return t("opening duels won {w} of {n}", { w: m[1]!, n: m[2]! });
      m = UNDERDOG.exec(part);
      if (m)
        return t(
          "rounds won while bought below the enemy {a}/{b} vs enemy {c}/{d}",
          { a: m[1]!, b: m[2]!, c: m[3]!, d: m[4]! },
        );
      return part;
    })
    .join("; ");
}
