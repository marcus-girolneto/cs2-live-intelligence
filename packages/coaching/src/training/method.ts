/**
 * The pro-team practice method every training plan follows (docs/COACHING_METHOD.md). It is a
 * shared constant so prompts can reference the same structure the deterministic plans use.
 * No real coach is named anywhere in the product: this is "the pro-team method".
 */
export const SESSION_STEPS = [
  "review",
  "warmup",
  "habit",
  "focus",
  "debrief",
] as const;
export type SessionStep = (typeof SESSION_STEPS)[number];

/** Default minutes per step (a full session is about 75 to 90 minutes). */
export const STEP_MINUTES: Record<SessionStep, number> = {
  review: 20,
  warmup: 15,
  habit: 15,
  focus: 30,
  debrief: 5,
};

export const PRO_COACH_METHOD = {
  name: "Pro-team method",
  steps: [
    {
      step: "review",
      rule: "Targeted demo review first: one precise question, only your deaths in lost rounds, about 20 minutes, 30 to 60 minutes after the match, with notes.",
    },
    {
      step: "warmup",
      rule: "Short mechanical warmup, 10 to 15 minutes. Never a long unfocused deathmatch.",
    },
    {
      step: "habit",
      rule: "Map, side, area and role specific habit block: practice the exact spots where you fight.",
    },
    {
      step: "focus",
      rule: "Focused play block (queue, scrim or deathmatch) with ONE objective that the next review measures.",
    },
    {
      step: "debrief",
      rule: "Short written debrief: what improved, what to keep, the question for the next review.",
    },
  ],
  principles: [
    "Every session names the map, side, area and role it trains.",
    "Every session has a measurable success criterion; the next review checks it.",
    "Deathmatch alone does not fix utility, economy or positioning.",
    "Play your own style with energy and confidence: preparation on the server builds it.",
    "One short mindset cue per plan, no theory walls.",
  ],
} as const;

/** The method as one prompt-ready paragraph (for AI purposes that reference it). */
export const PRO_COACH_METHOD_TEXT = [
  `${PRO_COACH_METHOD.name}: every practice day follows Review, Warmup, Area habit, Focused block, Debrief.`,
  ...PRO_COACH_METHOD.steps.map((s) => s.rule),
  ...PRO_COACH_METHOD.principles,
].join(" ");
