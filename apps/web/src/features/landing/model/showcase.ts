/**
 * Landing showcase content. Numbers in MISTAKES come from the public sample match
 * (de_mirage) shipped with the app; player names are never shown.
 */
import { Crosshair, Flashbang, Skull } from "@/shared/icons";

export type Mode = "post" | "live";

export const MISTAKES = [
  {
    id: "alone",
    icon: Skull,
    title: "Died alone",
    stat: "0 of 9",
    statLabel: "deaths a teammate could trade",
    coach:
      "You keep taking fights alone. Play within trade distance of a teammate — or wait for the flash before you swing.",
    fix: "Trade within 2 seconds on every entry.",
  },
  {
    id: "flash",
    icon: Flashbang,
    title: "Flash that blinded your team",
    stat: "9 vs 4",
    statLabel: "teammates blinded vs enemies blinded",
    coach:
      "Your flashes blind your own team more than the enemy: 13.7 seconds of white screen for your teammates. Call it, then throw it over the angle — never into their backs.",
    fix: "Pop-flash over the angle, called before you throw.",
  },
  {
    id: "low",
    icon: Crosshair,
    title: "Crosshair too low",
    stat: "3 of 32",
    statLabel: "hits on the head (9%)",
    coach:
      "Your crosshair sits at chest height. Pre-aim head height on every common angle and let them walk into it.",
    fix: "Head-height pre-aim drill, 10 minutes a day.",
  },
] as const;
export type MistakeId = (typeof MISTAKES)[number]["id"];

/** The post-match preview: the coach's verdict on the sample key moment. */
export const VERDICT =
  "You took the mid fight alone at 0:38 and nobody could trade you. Wait for the flash — or a teammate — before you swing.";

/** Live HUD demo: one round ending, then the IGL call for the next one. */
export const LIVE_ROUND = {
  round: 7,
  before: { ct: 3, t: 3, kills: 4, deaths: 5 },
  after: { ct: 4, t: 3, kills: 5, deaths: 5 },
  money: 3250,
  freezeSeconds: 14,
};
export const IGL_CALL =
  "Round 7 · Buy armor and play for the trade on A — you died alone 3 rounds in a row.";

/** The frustration board: an illustration of losses before the plan and wins after it. */
export const LOSS_FEED = [
  { text: "Died alone at Top Mid", tag: "no trade" },
  { text: "Flashed your own entry", tag: "team flash" },
  { text: "Lost the AWP duel at A", tag: "crosshair low" },
  { text: "Peeked Connector on the default", tag: "dry peek" },
] as const;
export const BEFORE_SCORES = ["9–13", "11–13", "7–13"] as const;
export const AFTER_SCORES = ["13–10", "11–13", "13–8"] as const;
