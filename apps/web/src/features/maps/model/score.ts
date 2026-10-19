import { finite } from "@/shared/format";

/** Final team score of a timeline entry as {won, lost}, or null when either side is unknown. */
export function finalScore(
  entry:
    | {
        roundsWon?: unknown;
        roundsLost?: unknown;
      }
    | null
    | undefined,
): { won: number; lost: number } | null {
  const won = finite(entry?.roundsWon);
  const lost = finite(entry?.roundsLost);
  return won !== null && lost !== null ? { won, lost } : null;
}

/** "13–9" (en dash) or null. */
export function formatScore(
  entry: Parameters<typeof finalScore>[0],
): string | null {
  const s = finalScore(entry);
  return s ? `${s.won}–${s.lost}` : null;
}
