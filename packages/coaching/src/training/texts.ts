/**
 * English source texts of the training sessions. The API returns `code` + `params` with the
 * filled English text; the web localizes from the same templates. Short, coach-like copy.
 * Placeholders: {area} {side} {map} {n}.
 */
import type { TrainingSkill } from "./catalog.js";

export const SESSION_TEXTS = {
  review_zone: {
    title: "Review: why did you die at {area}?",
    why: "You died {n} times at {area} on {side}. Watch only those deaths in lost rounds, 30 to 60 minutes after the match.",
    successCriteria:
      "Write one sentence: what you will do differently at {area}.",
  },
  review_deaths: {
    title: "Review: your deaths in lost rounds",
    why: "One question per review: what killed you first in the rounds you lost?",
    successCriteria: "Write the one mistake you saw most often.",
  },
  warmup_aim: {
    title: "Warmup: Aim Botz, head height only",
    why: "Short mechanical warmup before the habit block. No long deathmatch.",
    successCriteria:
      "100 kills standing still, crosshair at head height; stop at 15 minutes.",
  },
  warmup_spray: {
    title: "Warmup: spray control",
    why: "Your shots after the first bullet miss too often.",
    successCriteria:
      "AK-47 and M4 patterns at 10 m: most bullets inside the head-chest box.",
  },
  habit_crosshair_spots: {
    title: "{map}: your crosshair spots",
    why: "Teleport to {n} duels you started with the crosshair off target. Each spot shows where your crosshair should have been.",
    successCriteria:
      "Keep your crosshair at head height on {area}: on target in 8 of 10 reps.",
  },
  habit_prefire: {
    title: "{map} prefire route",
    why: "Clear the route you play with the crosshair at head height on every corner.",
    successCriteria: "Run the route twice without missing the first bullet.",
  },
  habit_lineups: {
    title: "{map}: repeat your best throws",
    why: "Teleport to {n} of your own throws: rehearse the good ones and fix the team flashes.",
    successCriteria: "Land each lineup 4 times out of 5.",
  },
  habit_utility_map: {
    title: "{map} utility map",
    why: "Learn 2 smokes and 1 flash for the area you play.",
    successCriteria: "Throw each new lineup 5 times in a row without help.",
  },
  habit_death_spots: {
    title: "{map}: hold the angle from where you died",
    why: "Teleport to your {n} death and enemy spots. See the angle the enemy had on you.",
    successCriteria:
      "For each spot, find a position where only one enemy angle sees you.",
  },
  habit_spray: {
    title: "Recoil Master: spray transfer",
    why: "Spray control decides your trades after the first bullet.",
    successCriteria: "Kill 2 bots in one spray, 5 times.",
  },
  habit_movement: {
    title: "Counter-strafe drill",
    why: "Shooting while moving costs your first bullet.",
    successCriteria: "Most stops are perfect before you shoot.",
  },
  habit_aim: {
    title: "Aim Botz: first-bullet focus",
    why: "Your first bullet decides your duels.",
    successCriteria: "50 kills with one tap at head height.",
  },
  focus_crosshair: {
    title: "Focused block: pre-aim every corner",
    why: "Play one deathmatch or match with ONE objective on {map}.",
    successCriteria:
      "Next review: more duels with the crosshair on target than this match.",
  },
  focus_positioning: {
    title: "Focused block: no isolated deaths at {area}",
    why: "Play {side} at {area} next to a teammate who can trade you.",
    successCriteria: "Next review: fewer untraded deaths at {area}.",
  },
  focus_utility: {
    title: "Focused block: every flash blinds an enemy",
    why: "Throw your lineups in a real match on {map}, call them before you throw.",
    successCriteria: "Next review: zero team flashes, more enemies blinded.",
  },
  focus_aim: {
    title: "Focused block: headshots only",
    why: "One deathmatch with one objective, then queue.",
    successCriteria: "Next review: headshot rate higher than this match.",
  },
  focus_spray: {
    title: "Focused block: burst, then spray",
    why: "One deathmatch: tap at range, spray only up close.",
    successCriteria: "Next review: accuracy higher than this match.",
  },
  focus_movement: {
    title: "Focused block: counter-strafe every kill",
    why: "One deathmatch with one objective.",
    successCriteria: "Next review: accuracy higher than this match.",
  },
  debrief: {
    title: "Debrief: 3 lines",
    why: "What improved, what to keep, the question for the next review.",
    successCriteria: "Three lines written before you close the game.",
  },
} as const;
export type SessionCode = keyof typeof SESSION_TEXTS;

export const fillTemplate = (
  template: string,
  params: Record<string, string | number>,
): string =>
  template.replace(/\{(\w+)\}/g, (m, k: string) =>
    k in params ? String(params[k]) : m,
  );

export function sessionText(
  code: SessionCode,
  params: Record<string, string | number>,
): { title: string; why: string; successCriteria: string } {
  const t = SESSION_TEXTS[code];
  return {
    title: fillTemplate(t.title, params).slice(0, 400),
    why: fillTemplate(t.why, params).slice(0, 400),
    successCriteria: fillTemplate(t.successCriteria, params).slice(0, 400),
  };
}

/** One-line mindset cue per plan (energy and confidence, no therapy talk). */
export const MINDSET: Record<TrainingSkill, string> = {
  crosshair: "Trust the spots you prepared: look there first, then shoot.",
  positioning:
    "Play your angle with confidence: you have seen it from both sides.",
  utility: "Call it, throw it, swing it: your lineups are ready.",
  aim: "Play your own style: confident first bullets, no hesitation.",
  spray: "Stay calm in the spray: you trained this pattern.",
  movement: "Stop, shoot, move: clean and confident.",
};
