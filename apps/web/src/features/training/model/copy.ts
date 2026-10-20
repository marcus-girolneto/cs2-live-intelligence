/**
 * Localized copy of the training plan. The API sends `code` + `params` with English text; the
 * web renders its own t() templates (same English source) so every language can translate them.
 * Unknown codes fall back to the API's English text.
 */
import type { Session, Skill, Step, Teleport } from "./types";

type T = (text: string, vars?: Record<string, string | number>) => string;
type Copy = { title: string; why: string; criteria: string };

export function sessionCopy(
  s: Session,
  t: T,
  place: (p: string) => string,
): Copy {
  const v: Record<string, string | number> = {
    ...s.params,
    ...(typeof s.params.area === "string"
      ? { area: place(s.params.area) }
      : {}),
  };
  const c = (title: string, why: string, criteria: string): Copy => ({
    title: t(title, v),
    why: t(why, v),
    criteria: t(criteria, v),
  });
  switch (s.code) {
    case "review_zone":
      return c(
        "Review: why did you die at {area}?",
        "You died {n} times at {area} on {side}. Watch only those deaths in lost rounds, 30 to 60 minutes after the match.",
        "Write one sentence: what you will do differently at {area}.",
      );
    case "review_deaths":
      return c(
        "Review: your deaths in lost rounds",
        "One question per review: what killed you first in the rounds you lost?",
        "Write the one mistake you saw most often.",
      );
    case "warmup_aim":
      return c(
        "Warmup: Aim Botz, head height only",
        "Short mechanical warmup before the habit block. No long deathmatch.",
        "100 kills standing still, crosshair at head height; stop at 15 minutes.",
      );
    case "warmup_spray":
      return c(
        "Warmup: spray control",
        "Your shots after the first bullet miss too often.",
        "AK-47 and M4 patterns at 10 m: most bullets inside the head-chest box.",
      );
    case "habit_crosshair_spots":
      return c(
        "{map}: your crosshair spots",
        "Teleport to {n} duels you started with the crosshair off target. Each spot shows where your crosshair should have been.",
        "Keep your crosshair at head height on {area}: on target in 8 of 10 reps.",
      );
    case "habit_prefire":
      return c(
        "{map} prefire route",
        "Clear the route you play with the crosshair at head height on every corner.",
        "Run the route twice without missing the first bullet.",
      );
    case "habit_lineups":
      return c(
        "{map}: repeat your best throws",
        "Teleport to {n} of your own throws: rehearse the good ones and fix the team flashes.",
        "Land each lineup 4 times out of 5.",
      );
    case "habit_utility_map":
      return c(
        "{map} utility map",
        "Learn 2 smokes and 1 flash for the area you play.",
        "Throw each new lineup 5 times in a row without help.",
      );
    case "habit_death_spots":
      return c(
        "{map}: hold the angle from where you died",
        "Teleport to your {n} death and enemy spots. See the angle the enemy had on you.",
        "For each spot, find a position where only one enemy angle sees you.",
      );
    case "habit_spray":
      return c(
        "Recoil Master: spray transfer",
        "Spray control decides your trades after the first bullet.",
        "Kill 2 bots in one spray, 5 times.",
      );
    case "habit_movement":
      return c(
        "Counter-strafe drill",
        "Shooting while moving costs your first bullet.",
        "Most stops are perfect before you shoot.",
      );
    case "habit_aim":
      return c(
        "Aim Botz: first-bullet focus",
        "Your first bullet decides your duels.",
        "50 kills with one tap at head height.",
      );
    case "focus_crosshair":
      return c(
        "Focused block: pre-aim every corner",
        "Play one deathmatch or match with ONE objective on {map}.",
        "Next review: more duels with the crosshair on target than this match.",
      );
    case "focus_positioning":
      return c(
        "Focused block: no isolated deaths at {area}",
        "Play {side} at {area} next to a teammate who can trade you.",
        "Next review: fewer untraded deaths at {area}.",
      );
    case "focus_utility":
      return c(
        "Focused block: every flash blinds an enemy",
        "Throw your lineups in a real match on {map}, call them before you throw.",
        "Next review: zero team flashes, more enemies blinded.",
      );
    case "focus_aim":
      return c(
        "Focused block: headshots only",
        "One deathmatch with one objective, then queue.",
        "Next review: headshot rate higher than this match.",
      );
    case "focus_spray":
      return c(
        "Focused block: burst, then spray",
        "One deathmatch: tap at range, spray only up close.",
        "Next review: accuracy higher than this match.",
      );
    case "focus_movement":
      return c(
        "Focused block: counter-strafe every kill",
        "One deathmatch with one objective.",
        "Next review: accuracy higher than this match.",
      );
    case "debrief":
      return c(
        "Debrief: 3 lines",
        "What improved, what to keep, the question for the next review.",
        "Three lines written before you close the game.",
      );
    default:
      return { title: s.title, why: s.why, criteria: s.criteria };
  }
}

export function stepLabel(step: Step, t: T): string {
  switch (step) {
    case "review":
      return t("Review");
    case "warmup":
      return t("Warmup");
    case "habit":
      return t("Area habit");
    case "focus":
      return t("Focused block");
    default:
      return t("Debrief");
  }
}

export function skillLabel(skill: Skill, t: T): string {
  switch (skill) {
    case "aim":
      return t("Aim");
    case "crosshair":
      return t("Crosshair placement");
    case "utility":
      return t("Utility");
    case "spray":
      return t("Spray control");
    case "movement":
      return t("Movement");
    default:
      return t("Positioning");
  }
}

export function mindsetCopy(skill: Skill | null, fallback: string, t: T) {
  switch (skill) {
    case "crosshair":
      return t("Trust the spots you prepared: look there first, then shoot.");
    case "positioning":
      return t(
        "Play your angle with confidence: you have seen it from both sides.",
      );
    case "utility":
      return t("Call it, throw it, swing it: your lineups are ready.");
    case "aim":
      return t("Play your own style: confident first bullets, no hesitation.");
    case "spray":
      return t("Stay calm in the spray: you trained this pattern.");
    case "movement":
      return t("Stop, shoot, move: clean and confident.");
    default:
      return fallback;
  }
}

function nadeName(g: string | null, t: T): string {
  if (g === "he") return t("HE");
  if (g === "flash") return t("flash");
  if (g === "smoke") return t("smoke");
  if (g === "molotov") return t("molotov");
  return t("grenade");
}

/** Short label of a teleport (no angles in the text; the command carries them). */
export function teleportLabel(
  tp: Teleport,
  t: T,
  place: (p: string) => string,
): string {
  const where = tp.callout ? place(tp.callout) : t("unknown spot");
  const round = tp.round ?? 0;
  switch (tp.kind) {
    case "death":
      return t("Round {round}: where you died at {where}", { round, where });
    case "enemy":
      return t("Round {round}: where the enemy was ({where})", {
        round,
        where,
      });
    case "lineup":
      return t("Round {round}: your {nade} into {where}", {
        round,
        where,
        nade: nadeName(tp.grenade, t),
      });
    case "teamflash":
      return t("Round {round}: the flash into {where} that blinded teammates", {
        round,
        where,
      });
    default:
      return t(
        "Round {round}: {where}, this is where your crosshair should have been",
        { round, where },
      );
  }
}

/** Teleport groups shown in the practice-server box. */
export const TELEPORT_GROUPS: { kinds: Teleport["kind"][]; key: string }[] = [
  { kinds: ["death", "enemy"], key: "died" },
  { kinds: ["lineup", "teamflash"], key: "lineups" },
  { kinds: ["crosshair"], key: "crosshair" },
];
export function groupTitle(key: string, t: T): string {
  if (key === "died") return t("Where you died");
  if (key === "lineups") return t("Your best lineups");
  return t("Crosshair spots");
}

export function roleLabel(role: string | null, t: T): string | null {
  switch (role) {
    case "entry":
      return t("Entry");
    case "support":
      return t("Support");
    case "lurker":
      return t("Lurker");
    case "anchor":
      return t("Anchor");
    case "rifler":
      return t("Rifler");
    default:
      return null;
  }
}

export function dayLabel(day: number, t: T): string {
  return t("Day {n}", { n: day });
}

/** Workshop titles stay as published; our own official entries are translated. */
export function resourceTitle(
  r: { kind: "workshop" | "official"; id: string; title: string },
  t: T,
): string {
  if (r.kind === "workshop") return r.title;
  if (r.id === "official-deathmatch") return t("Deathmatch (official mode)");
  if (r.id === "practice-server")
    return t("Private practice server (official map + config)");
  if (r.id === "your-spots") return t("Your spots on a practice server");
  return r.title;
}
