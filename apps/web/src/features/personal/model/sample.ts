import type { PersonalPlan } from "./personal";

/** Illustrative plan shown blurred behind the locked teaser (never presented as real data). */
export const SAMPLE_PLAN: PersonalPlan = {
  headline: "You win your duels. Now win them with your team.",
  workingWell: [
    { text: "Opening duels on CT side", evidence: "58% won" },
    { text: "Smokes on executes", evidence: "86% useful" },
  ],
  notWorking: [
    { text: "Deaths nobody trades", evidence: "47% isolated" },
    { text: "Crosshair at chest height", evidence: "6 of 15 on target" },
  ],
  focusAreas: [
    {
      area: "Trading",
      why: "Swing with a teammate.",
      targetMetric: "Traded deaths %",
      current: 29,
      target: 45,
      progress: 64,
    },
    {
      area: "Pre-aim",
      why: "Head height on every corner.",
      targetMetric: "On target %",
      current: 40,
      target: 55,
      progress: 73,
    },
    {
      area: "Flashes",
      why: "Pop flashes before entries.",
      targetMetric: "Flash efficiency %",
      current: 33,
      target: 50,
      progress: 66,
    },
  ],
  weeklyProgram: [
    {
      week: 1,
      goals: ["Trade within 2 s"],
      drills: [
        { id: "s1", name: "Prefire maps", minutesPerDay: 10, howTo: null },
      ],
    },
    {
      week: 2,
      goals: ["Pre-aim at head height"],
      drills: [
        {
          id: "s2",
          name: "Deathmatch, head only",
          minutesPerDay: 15,
          howTo: null,
        },
      ],
    },
  ],
  perMap: [],
  nextReviewSuggestion: null,
  generatedAt: null,
  basedOnMatches: 12,
  caveats: [],
};
