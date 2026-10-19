/**
 * Deterministic, server-side parts of the v5 review: lobby-relative scores, replay clip
 * windows around cited events, key-moment candidates and map/general scoping. Nothing here
 * calls a model; the model only chooses among what these functions supply.
 */
import type { Analysis, Clip, Coaching, DemoEvent } from "@cs2/contracts";

type Player = Analysis["players"][number];
type Metric = Player["adr"];
type Scores = NonNullable<Coaching["scores"]>;
type Score = NonNullable<Scores["aim"]>;
export type Scope = "map" | "general";

const usable = (m: Metric | undefined): m is Metric =>
  !!m && m.complete && m.value !== null && Number.isFinite(m.value);
const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------------------------
// Scores
// ---------------------------------------------------------------------------------------------

/** Minimum lobby players with a complete value before a component is scored. */
export const MIN_LOBBY = 4;
/**
 * Component score = clamp(round(50 + 20 * z), 0, 100) with z = (x - lobbyMean) / max(lobbySd,
 * floor), sign flipped for lower-is-better components. The lobby includes the player. The
 * dimension score is the mean of its available components; a dimension is omitted when none
 * of its components is available (incomplete metric, or fewer than MIN_LOBBY lobby values).
 */
export const SCORE_FORMULA =
  "component = clamp(50 + 20 * z, 0, 100), z = (player - lobby mean) / max(lobby sd, floor), inverted when lower is better; dimension = mean of available components";
export const scoreLabel = (v: number): Score["label"] =>
  v >= 75
    ? "elite"
    : v >= 58
      ? "good"
      : v >= 42
        ? "average"
        : v >= 25
          ? "below"
          : "poor";

type Component = {
  name: string;
  unit: string;
  /** Minimum standard deviation, so near-identical lobbies do not exaggerate tiny gaps. */
  floor: number;
  lowerIsBetter?: boolean;
  value: (p: Player) => number | null;
};
const rounds = (p: Player) => p.rounds?.length ?? 0;
const adv = (key: string) => (p: Player) => {
  const m = p.advanced?.[key];
  return usable(m) ? m.value! : null;
};
const perRound = (key: string) => (p: Player) => {
  const m = p.advanced?.[key];
  return usable(m) && rounds(p) > 0 ? m.value! / rounds(p) : null;
};

/**
 * Components per dimension (formula in SCORE_FORMULA):
 * - aim: accuracy, headshot hit rate, headshot kill % (>= 3 kills)
 * - positioning: survival %, early deaths per round (lower is better), mean death time
 * - utility: utility damage per round, enemies flashed per round, flash assists per round
 * - trading: deaths traded % (>= 2 deaths), trade kills per round
 * - economy: damage per $1000 of freeze-time equipment, anti-eco rounds won % (>= 2)
 * - impact: KAST, ADR, opening duels won % (>= 2 duels), multi-kill rounds per round
 */
export const SCORE_COMPONENTS: Record<keyof Scores, Component[]> = {
  aim: [
    { name: "accuracy", unit: "%", floor: 3, value: adv("accuracy") },
    {
      name: "headshot hit rate",
      unit: "%",
      floor: 4,
      value: adv("headshot-hit-rate"),
    },
    {
      name: "headshot kills",
      unit: "%",
      floor: 8,
      value: (p) =>
        usable(p.headshotPercentage) && p.headshotPercentage.denominator >= 3
          ? p.headshotPercentage.value!
          : null,
    },
  ],
  positioning: [
    { name: "survival", unit: "%", floor: 8, value: adv("survival") },
    {
      name: "early deaths per round",
      unit: "",
      floor: 0.05,
      lowerIsBetter: true,
      value: perRound("early-deaths"),
    },
    {
      name: "average death time",
      unit: "s",
      floor: 4,
      value: adv("avg-death-time"),
    },
  ],
  utility: [
    {
      name: "utility damage per round",
      unit: "",
      floor: 2,
      value: adv("utility-damage-per-round"),
    },
    {
      name: "enemies flashed per round",
      unit: "",
      floor: 0.1,
      value: adv("enemies-flashed-per-round"),
    },
    {
      name: "flash assists per round",
      unit: "",
      floor: 0.03,
      value: perRound("flash-assists"),
    },
  ],
  trading: [
    {
      name: "deaths traded",
      unit: "%",
      floor: 8,
      value: (p) => {
        const m = p.advanced?.["traded-deaths"];
        return usable(m) && m.denominator >= 2 ? m.value! : null;
      },
    },
    {
      name: "trade kills per round",
      unit: "",
      floor: 0.04,
      value: perRound("trade-kills"),
    },
  ],
  economy: [
    {
      name: "damage per $1000 of equipment",
      unit: "",
      floor: 3,
      value: (p) => {
        const rows = (p.rounds ?? []).filter(
          (r) => r.equipmentValue !== undefined,
        );
        // Rounds without a freeze-time sample are skipped; most rounds must be covered.
        if (!rows.length || rows.length < 0.8 * rounds(p)) return null;
        const spend = rows.reduce((n, r) => n + r.equipmentValue!, 0);
        const damage = rows.reduce((n, r) => n + r.damage, 0);
        return spend > 0 ? (1000 * damage) / spend : null;
      },
    },
    {
      name: "anti-eco rounds won",
      unit: "%",
      floor: 10,
      value: (p) => {
        const m = p.advanced?.["anti-eco-win-rate"];
        return usable(m) && m.denominator >= 2 ? m.value! : null;
      },
    },
  ],
  impact: [
    { name: "KAST", unit: "%", floor: 6, value: adv("kast") },
    {
      name: "ADR",
      unit: "",
      floor: 8,
      value: (p) => (usable(p.adr) ? p.adr.value! : null),
    },
    {
      name: "opening duels won",
      unit: "%",
      floor: 10,
      value: (p) => {
        const m = p.advanced?.["opening-success"];
        return usable(m) && m.denominator >= 2 ? m.value! : null;
      },
    },
    {
      name: "multi-kill rounds per round",
      unit: "",
      floor: 0.04,
      value: perRound("multi-kill-rounds"),
    },
  ],
};

const fmt = (v: number, unit: string) =>
  unit === "%" ? `${r1(v)}%` : unit === "s" ? `${r1(v)} s` : `${r2(v)}`;

/** Lobby-relative 0-100 scores for one player; absent dimensions lack complete data. */
export function playerScores(
  analysis: Analysis,
  steamId: string,
): Coaching["scores"] | undefined {
  const player = analysis.players.find((p) => p.steamId === steamId);
  if (!player) return undefined;
  const out: Scores = {};
  for (const [dim, components] of Object.entries(SCORE_COMPONENTS) as [
    keyof Scores,
    Component[],
  ][]) {
    const parts: { score: number; text: string }[] = [];
    for (const c of components) {
      const mine = c.value(player);
      if (mine === null || !Number.isFinite(mine)) continue;
      const lobby = analysis.players
        .map(c.value)
        .filter((v): v is number => v !== null && Number.isFinite(v));
      if (lobby.length < MIN_LOBBY) continue;
      const mean = lobby.reduce((a, b) => a + b, 0) / lobby.length;
      const sd = Math.sqrt(
        lobby.reduce((a, b) => a + (b - mean) ** 2, 0) / lobby.length,
      );
      const z =
        ((c.lowerIsBetter ? -1 : 1) * (mine - mean)) / Math.max(sd, c.floor);
      parts.push({
        score: Math.max(0, Math.min(100, 50 + 20 * z)),
        text: `${c.name} ${fmt(mine, c.unit)} (lobby ${fmt(mean, c.unit)})`,
      });
    }
    if (!parts.length) continue;
    const value = Math.round(
      parts.reduce((a, b) => a + b.score, 0) / parts.length,
    );
    out[dim] = {
      value,
      label: scoreLabel(value),
      basis: parts
        .map((p) => p.text)
        .join("; ")
        .slice(0, 500),
    };
  }
  return Object.keys(out).length ? out : undefined;
}

// ---------------------------------------------------------------------------------------------
// Clips
// ---------------------------------------------------------------------------------------------

export const CLIP_BEFORE = 7;
export const CLIP_AFTER = 2;
/** Seconds kept after a round's last observed event (round end is not timed by the parser). */
export const ROUND_TAIL = 3;

type Timed = DemoEvent & { roundTime: number };
const timed = (e: DemoEvent): e is Timed =>
  typeof (e as { roundTime?: unknown }).roundTime === "number";

/** Last timed event per round, used to clamp clip windows to the round. */
export function roundEnds(analysis: Analysis) {
  const ends = new Map<number, number>();
  for (const e of analysis.events ?? [])
    if (timed(e))
      ends.set(e.round, Math.max(ends.get(e.round) ?? 0, e.roundTime));
  return ends;
}

/**
 * Replay windows around events: [t - 7, t + 2] clamped to the round, overlapping windows in
 * the same round merged. Events are taken in the given order (callers put the preferred ones
 * first) and at most `max` windows are returned.
 */
export function clipsFor(
  analysis: Analysis,
  events: Timed[],
  focusSteamId: string,
  max = 3,
  label?: string,
): Clip[] {
  const ends = roundEnds(analysis);
  const clips: Clip[] = [];
  events.forEach((e) => {
    const end = (ends.get(e.round) ?? e.roundTime) + ROUND_TAIL;
    const from = r2(Math.max(0, e.roundTime - CLIP_BEFORE));
    const to = r2(Math.min(end, e.roundTime + CLIP_AFTER));
    const overlap = clips.find(
      (c) => c.round === e.round && from <= c.to && to >= c.from,
    );
    if (overlap) {
      overlap.from = Math.min(overlap.from, from);
      overlap.to = Math.max(overlap.to, to);
      if (overlap.eventIds.length < 20) overlap.eventIds.push(e.id);
      return;
    }
    if (clips.length >= max) return;
    clips.push({
      round: e.round,
      from,
      to,
      focusSteamId,
      eventIds: [e.id],
      ...(label ? { label: label.slice(0, 200) } : {}),
    });
  });
  return clips;
}

/**
 * Clips for an insight from its cited evidence: the player's kills, deaths and damage with a
 * round time. "improve" insights prefer the player's deaths, "strength" ones their kills.
 */
export function insightClips(
  analysis: Analysis,
  evidenceIds: string[],
  focusSteamId: string,
  kind: "strength" | "improve" | undefined,
): Clip[] {
  const byId = new Map((analysis.events ?? []).map((e) => [e.id, e]));
  const evidence = new Map(analysis.evidence.map((e) => [e.id, e]));
  const seen = new Set<string>();
  const events: Timed[] = [];
  for (const id of evidenceIds)
    for (const eventId of evidence.get(id)?.eventIds ?? []) {
      const e = byId.get(eventId);
      if (!e || seen.has(eventId) || !timed(e)) continue;
      if (e.type !== "kill" && e.type !== "damage") continue;
      if (e.attackerId !== focusSteamId && e.victimId !== focusSteamId)
        continue;
      seen.add(eventId);
      events.push(e);
    }
  const rank = (e: Timed) => {
    const death = e.type === "kill" && e.victimId === focusSteamId;
    const kill = e.type === "kill" && e.attackerId === focusSteamId;
    if (kind === "strength") return kill ? 0 : death ? 2 : 1;
    return death ? 0 : kill ? 2 : 1;
  };
  events.sort(
    (a, b) =>
      rank(a) - rank(b) || a.round - b.round || a.roundTime - b.roundTime,
  );
  return clipsFor(analysis, events, focusSteamId, 3);
}

// ---------------------------------------------------------------------------------------------
// Key-moment candidates
// ---------------------------------------------------------------------------------------------

export type MomentCandidate = {
  id: string;
  /**
   * What the event was for the coached player, stated explicitly so the model cannot invert it:
   * "YOU KILLED an enemy" or "YOU DIED to an enemy" (names are never sent).
   */
  outcome: string;
  round: number;
  time: number;
  kind: "kill" | "death";
  side?: "CT" | "T";
  /** Alive players (your side v enemy side) just before this event. */
  situation?: string;
  opening: boolean;
  /** Death: a teammate killed your killer within 5 s. Kill: you avenged a teammate within 5 s. */
  traded?: boolean;
  tradeKill?: boolean;
  yourPlace?: string;
  enemyPlace?: string;
  weapon?: string;
  distanceMeters?: number;
  headshot?: boolean;
  /** Your health just before the duel (100 minus damage taken earlier in the round). */
  yourHpBefore?: number;
  throughSmoke?: boolean;
  wallbang?: boolean;
  youWereBlind?: boolean;
  roundWon?: boolean;
  buyType?: string;
};
export const MAX_CANDIDATES = 40;
const TRADE_SECONDS = 5;
const clean = (s?: string) =>
  s
    ? s.replace(/[^\p{L}\p{N} _.-]/gu, "").slice(0, 64) || undefined
    : undefined;

/** Explicit outcome line of a candidate (see MomentCandidate.outcome). */
export const momentOutcome = (kind: "kill" | "death"): string =>
  kind === "kill" ? "YOU KILLED an enemy" : "YOU DIED to an enemy";

/** A key moment's card kind follows the event: the player's kill → highlight, death → mistake. */
export const momentKind = (kind: "kill" | "death"): "highlight" | "mistake" =>
  kind === "kill" ? "highlight" : "mistake";

const SAID_KILL = [
  /\byou (?:killed|kill|get|got|take|took|won|win|secured?|landed?|traded) (?:the |a |an |your |an? \w+ )?(?:kill|frag|pick|duel|entry|opening)/i,
  /\byou (?:killed|kill|eliminated?|took down|picked off|traded|avenged|refragged)\b/i,
  /\bvoc[êe] (?:matou|mata|abateu|abate|eliminou|elimina|venceu o duelo|ganhou o duelo|pegou o abate)\b/i,
];
const SAID_DEATH = [
  /\byou (?:died|die|dies|were killed|got killed|get killed|were picked|got picked|lost the duel|lose the duel|were traded|got traded|were caught|got caught)\b/i,
  /\b(?:killed|kills|picked|caught) you\b/i,
  /\b(?:and|then|but) (?:died|die|got killed|were killed)\b/i,
  /\b(?:e|mas|depois) (?:morreu|morre|foi morto)\b/i,
  /\bvoc[êe] (?:morreu|morre|foi morto|foi abatido|perdeu o duelo|foi pego)\b/i,
  /\bte (?:matou|matam|mataram|abateu|pegou|pegaram)\b/i,
];

/**
 * True when a key moment's text describes the opposite outcome of its event: a kill described
 * as "you die"/"você morreu", or a death described as "you killed"/"você matou" (EN/PT), and
 * the text never states the real outcome. Such moments are dropped.
 */
export function contradictsOutcome(
  text: string,
  kind: "kill" | "death",
): boolean {
  const kill = SAID_KILL.some((r) => r.test(text));
  const death = SAID_DEATH.some((r) => r.test(text));
  return kind === "kill" ? death && !kill : kill && !death;
}

/** The coached player's kills and deaths with context, for the model to pick key moments. */
export function momentCandidates(
  analysis: Analysis,
  steamId: string,
): MomentCandidate[] {
  const player = analysis.players.find((p) => p.steamId === steamId);
  if (!player) return [];
  const rounds = new Map((player.rounds ?? []).map((r) => [r.round, r]));
  const events = (analysis.events ?? []).filter(timed);
  const byRound = new Map<number, Timed[]>();
  for (const e of events) {
    if (!byRound.has(e.round)) byRound.set(e.round, []);
    byRound.get(e.round)!.push(e);
  }
  const out: MomentCandidate[] = [];
  for (const [round, list] of byRound) {
    const info = rounds.get(round);
    if (!info?.side) continue;
    const mySide = info.side;
    const kills = list.filter(
      (e): e is Extract<Timed, { type: "kill" }> => e.type === "kill",
    );
    const sides = new Map<string, string>();
    for (const e of list)
      if (e.type === "kill" || e.type === "damage") {
        if (e.attackerId && e.attackerTeam)
          sides.set(e.attackerId, e.attackerTeam);
        if (e.victimTeam) sides.set(e.victimId, e.victimTeam);
      }
    // Alive counts from the round's participants by side, minus earlier deaths.
    const roster = { mine: 0, enemy: 0 };
    for (const p of analysis.players) {
      const side = p.rounds?.find((r) => r.round === round)?.side;
      if (side === mySide) roster.mine++;
      else if (side) roster.enemy++;
    }
    const first = kills[0];
    kills.forEach((k, index) => {
      const mine = k.attackerId === steamId;
      const died = k.victimId === steamId;
      if ((!mine && !died) || (mine && k.victimTeam === mySide)) return;
      const before = kills.slice(0, index);
      const deadMine = before.filter((d) => d.victimTeam === mySide).length;
      const deadEnemy = before.filter(
        (d) => d.victimTeam && d.victimTeam !== mySide,
      ).length;
      const taken = list
        .filter(
          (d) =>
            d.type === "damage" &&
            d.victimId === steamId &&
            d.roundTime < k.roundTime &&
            !(
              died &&
              d.attackerId === k.attackerId &&
              d.roundTime >= k.roundTime - 3
            ),
        )
        .reduce((n, d) => n + (d.type === "damage" ? d.healthDamage : 0), 0);
      const after = kills.filter(
        (x) =>
          x.roundTime > k.roundTime &&
          x.roundTime <= k.roundTime + TRADE_SECONDS,
      );
      const recent = kills.filter(
        (x) =>
          x.roundTime < k.roundTime &&
          x.roundTime >= k.roundTime - TRADE_SECONDS,
      );
      out.push({
        id: k.id,
        outcome: momentOutcome(mine ? "kill" : "death"),
        round,
        time: r2(k.roundTime),
        kind: mine ? "kill" : "death",
        side: mySide,
        ...(roster.mine && roster.enemy
          ? {
              situation: `${roster.mine - deadMine}v${roster.enemy - deadEnemy}`,
            }
          : {}),
        opening: first?.id === k.id,
        ...(died
          ? {
              traded: after.some(
                (x) =>
                  x.victimId === k.attackerId &&
                  sides.get(x.attackerId ?? "") === mySide,
              ),
            }
          : {
              tradeKill: recent.some(
                (x) => x.attackerId === k.victimId && x.victimTeam === mySide,
              ),
            }),
        ...(clean(mine ? k.attackerPlace : k.victimPlace)
          ? { yourPlace: clean(mine ? k.attackerPlace : k.victimPlace) }
          : {}),
        ...(clean(mine ? k.victimPlace : k.attackerPlace)
          ? { enemyPlace: clean(mine ? k.victimPlace : k.attackerPlace) }
          : {}),
        ...(clean(k.weapon) ? { weapon: clean(k.weapon) } : {}),
        ...(k.distance !== undefined ? { distanceMeters: k.distance } : {}),
        headshot: k.headshot,
        yourHpBefore: Math.max(0, 100 - taken),
        ...(k.throughSmoke ? { throughSmoke: true } : {}),
        ...(k.penetrated ? { wallbang: true } : {}),
        ...(mine && k.attackerBlind ? { youWereBlind: true } : {}),
        ...(info.won !== undefined ? { roundWon: info.won } : {}),
        ...(info.buyType ? { buyType: info.buyType } : {}),
      });
    });
  }
  // Keep the most telling moments when there are too many: openings and deaths first.
  const weight = (c: MomentCandidate) =>
    (c.opening ? 0 : 2) + (c.kind === "death" ? 0 : 1);
  return out
    .map((c, i) => ({ c, i }))
    .sort((a, b) =>
      out.length > MAX_CANDIDATES
        ? weight(a.c) - weight(b.c) || a.i - b.i
        : a.i - b.i,
    )
    .slice(0, MAX_CANDIDATES)
    .map(({ c }) => c)
    .sort((a, b) => a.round - b.round || a.time - b.time);
}

/** The clip for one key moment (its event plus nearby events of the same player). */
export function momentClip(
  analysis: Analysis,
  candidate: MomentCandidate,
  focusSteamId: string,
): Clip {
  const event = (analysis.events ?? []).find((e) => e.id === candidate.id);
  const [clip] = clipsFor(
    analysis,
    event && timed(event) ? [event] : [],
    focusSteamId,
    1,
  );
  return (
    clip ?? {
      round: candidate.round,
      from: r2(Math.max(0, candidate.time - CLIP_BEFORE)),
      to: r2(candidate.time + CLIP_AFTER),
      focusSteamId,
      eventIds: [candidate.id],
    }
  );
}

// ---------------------------------------------------------------------------------------------
// Scope
// ---------------------------------------------------------------------------------------------

/** Evidence about places/positions is map knowledge by definition. */
export const isMapEvidence = (kind: string) =>
  kind.startsWith("place-") || kind === "positions";

export function normalizeScope(value: unknown, fallback: Scope): Scope {
  return value === "map" || value === "general" ? value : fallback;
}
