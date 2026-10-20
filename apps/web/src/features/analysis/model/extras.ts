/** "You vs the lobby" ranks and match-integrity signals (both optional API extras). */
import { finite, text } from "@/shared/format";

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export type LobbyMetric = {
  key: string;
  label: string;
  unit: string;
  lowerIsBetter: boolean;
  value: number;
  rank: number;
  players: number;
  lobbyMedian: number | null;
  best: number | null;
};
/** GET analyses/:id/lobby → metrics the player has a rank for (best rank first). */
export function normalizeLobby(raw: unknown): LobbyMetric[] {
  const o = obj(raw);
  const total = finite(o.players);
  return arr(o.metrics)
    .flatMap((m) => {
      const x = obj(m);
      const key = text(x.key);
      const value = finite(x.value);
      const rank = finite(x.rank);
      const players = finite(x.players) ?? total;
      if (!key || value === null || rank === null || !players || rank < 1)
        return [];
      return [
        {
          key,
          label: text(x.label) ?? key,
          unit: text(x.unit) ?? "",
          lowerIsBetter: x.lowerIsBetter === true,
          value,
          rank: Math.min(rank, players),
          players,
          lobbyMedian: finite(x.lobbyMedian),
          best: finite(x.best),
        },
      ];
    })
    .sort((a, b) => a.rank / a.players - b.rank / b.players);
}

export type IntegrityLevel = "none" | "low" | "elevated" | "high";
export type IntegrityReason = {
  code: string;
  value: number | null;
  threshold: number | null;
  n: number | null;
};
export type IntegrityPlayer = {
  steamId: string;
  level: IntegrityLevel;
  reasons: IntegrityReason[];
};
export type BanInfo = {
  steamId: string;
  vac: number;
  game: number;
  daysSinceLastBan: number | null;
};
export type Integrity = {
  players: IntegrityPlayer[];
  bans: BanInfo[];
};
const LEVELS: IntegrityLevel[] = ["none", "low", "elevated", "high"];

/** GET analyses/:id/integrity → only flagged players and bans issued after the match. */
export function normalizeIntegrity(raw: unknown): Integrity {
  const o = obj(raw);
  const players = arr(o.players).flatMap((p) => {
    const x = obj(p);
    const steamId = text(x.steamId);
    const level = LEVELS.find((l) => l === x.level) ?? "none";
    if (!steamId || level === "none") return [];
    return [
      {
        steamId,
        level,
        reasons: arr(x.reasons).flatMap((r) => {
          const y = obj(r);
          const code = text(y.code);
          return code
            ? [
                {
                  code,
                  value: finite(y.value),
                  threshold: finite(y.threshold),
                  n: finite(y.n),
                },
              ]
            : [];
        }),
      },
    ];
  });
  const bans = arr(o.bannedAfterMatch).flatMap((b) => {
    const x = obj(b);
    const steamId = text(x.steamId);
    if (!steamId || x.bannedAfterMatch !== true) return [];
    return [
      {
        steamId,
        vac: finite(x.vacBans) ?? 0,
        game: finite(x.gameBans) ?? 0,
        daysSinceLastBan: finite(x.daysSinceLastBan),
      },
    ];
  });
  return { players, bans };
}

/** Steam ids whose kills get the discreet shield marker. */
export const flaggedIds = (i: Integrity | null) =>
  new Set(
    i
      ? [...i.players.map((p) => p.steamId), ...i.bans.map((b) => b.steamId)]
      : [],
  );

/**
 * Neutral, plain-language reason (EN source + params for t()). Never accusatory: these are
 * statistical signals, not proof.
 */
export function reasonText(r: IntegrityReason): {
  text: string;
  params?: Record<string, string | number>;
} {
  const n = r.n ?? 0;
  switch (r.code) {
    case "inhuman_snaps":
      return {
        text: "{k} very fast snaps landing exactly on the head (in {n} fights)",
        params: { k: r.value ?? 0, n },
      };
    case "headshot_rate":
      return {
        text: "Headshot rate far above the rest of the lobby ({n} kills)",
        params: { n },
      };
    case "head_hits_per_shot":
      return {
        text: "Unusually many head hits per shot ({n} shots)",
        params: { n },
      };
    case "reaction_time":
      return {
        text: "Hit back in {ms} ms on average after being shot ({n} times)",
        params: { ms: Math.round((r.value ?? 0) * 1000), n },
      };
    case "smoke_wall_kills":
      return {
        text: "{pct}% of kills through smoke or walls ({n} kills)",
        params: { pct: Math.round((r.value ?? 0) * 100), n },
      };
    default:
      return { text: "Statistically unusual play" };
  }
}

/** "Account banned by VAC 4 days after this match" (null days → without the delay). */
export function banText(
  b: BanInfo,
  matchAt: number | null,
  now = Date.now(),
): { text: string; params?: Record<string, number> } {
  const kind = b.vac > 0 ? "VAC" : "game";
  if (b.daysSinceLastBan !== null && matchAt !== null) {
    const banAt = now - b.daysSinceLastBan * 86_400_000;
    const days = Math.max(0, Math.round((banAt - matchAt) / 86_400_000));
    return {
      text:
        kind === "VAC"
          ? "Account banned by VAC {d} days after this match"
          : "Account received a game ban {d} days after this match",
      params: { d: days },
    };
  }
  return {
    text:
      kind === "VAC"
        ? "Account banned by VAC after this match"
        : "Account received a game ban after this match",
  };
}
