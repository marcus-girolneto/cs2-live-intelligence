/**
 * The team model only ever sees aliases P1-P5 (names never reach a model). Before a team
 * review is saved or shown, every human-readable field gets the players' display names back.
 * Stored reviews written before this mapping existed are mapped again on read (idempotent
 * for any review whose names are not themselves aliases).
 */
import type { Analysis, TeamReview } from "@cs2/contracts";

/** "Player 3" in the review's language when a member has no usable name. */
const PLAYER: Record<string, string> = {
  en: "Player",
  pt: "Jogador",
  es: "Jugador",
  ru: "Игрок",
  zh: "玩家",
  de: "Spieler",
  fr: "Joueur",
  pl: "Gracz",
  tr: "Oyuncu",
};
const ALIAS = /(?<![\p{L}\p{N}_])P([1-5])(?![\p{L}\p{N}_])/gu;

/** A display name safe to place in text: no control characters, trimmed, capped. */
export function displayNameOf(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const clean = raw
    .normalize("NFKC")
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 32);
  return clean || undefined;
}

/** Alias ("P1".."P5", members order) → display name. */
export function aliasNames(
  members: readonly string[],
  players: Analysis["players"],
  lang = "en",
): Map<string, string> {
  const byId = new Map(players.map((p) => [p.steamId, displayNameOf(p.name)]));
  return new Map(
    members.map((id, i) => [
      `P${i + 1}`,
      byId.get(id) ?? `${PLAYER[lang] ?? PLAYER.en} ${i + 1}`,
    ]),
  );
}

/** Replaces whole-word aliases ("P3", "o P5", "P3 e P1") with names; unknown aliases stay. */
export function replaceAliases(
  text: string,
  names: ReadonlyMap<string, string>,
  max?: number,
): string {
  const out = text.replace(ALIAS, (m, n: string) => names.get(`P${n}`) ?? m);
  return max === undefined ? out : out.slice(0, max);
}

/** Every human-readable field of a team review with names instead of aliases. */
export function nameTeamReview(
  review: TeamReview,
  players: Analysis["players"],
  lang = "en",
): TeamReview {
  const names = aliasNames(review.members, players, lang);
  const r = (text: string, max?: number) => replaceAliases(text, names, max);
  return {
    ...review,
    verdict: r(review.verdict, 120),
    roles: review.roles.map((role) => ({
      ...role,
      strengths: role.strengths.map((p) => ({ ...p, text: r(p.text, 300) })),
      fixes: role.fixes.map((p) => ({ ...p, text: r(p.text, 300) })),
    })),
    patterns: review.patterns.map((p) => ({ ...p, text: r(p.text, 400) })),
    keyRounds: review.keyRounds.map((k) => ({
      ...k,
      title: r(k.title, 120),
      whatHappened: r(k.whatHappened, 600),
      whatToDoInstead: r(k.whatToDoInstead, 600),
    })),
    plan: review.plan.map((p) => ({ ...p, text: r(p.text, 300) })),
    facts: review.facts.map((f) => ({
      ...f,
      description: r(f.description, 300),
    })),
    caveats: review.caveats.map((c) => r(c, 1000)),
  };
}
