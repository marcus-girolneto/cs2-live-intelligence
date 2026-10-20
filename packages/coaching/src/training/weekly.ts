/**
 * The weekly practice layout of the pro-team method: five practice days that each follow
 * Review, Warmup, Area habit, Focused block, Debrief (alternating the two weakest skills) and
 * two rest days. Deterministic; resources come from the verified catalog.
 */
import type { PracticeDay, TrainingPlan } from "@cs2/contracts";
import { mapEntry, type TrainingSkill } from "./catalog.js";
import { STEP_MINUTES } from "./method.js";

const PATTERN: (0 | 1 | null)[] = [0, 1, 0, null, 0, 1, null];

function habitResource(
  skill: TrainingSkill,
  map: string | undefined,
): string | undefined {
  if (skill === "crosshair") return mapEntry("prefire", map)?.id ?? "yprac-hub";
  if (skill === "utility")
    return mapEntry("utility", map)?.id ?? "practice-server";
  if (skill === "positioning") return "your-spots";
  if (skill === "spray") return "recoil-master";
  if (skill === "movement") return "counter-strafe-master";
  return "aim-botz";
}

export function weeklyPractice(
  plan: Pick<TrainingPlan, "focus" | "map">,
): PracticeDay[] {
  const skills = plan.focus.length ? plan.focus : (["aim"] as TrainingSkill[]);
  return PATTERN.map((pick, i) => {
    if (pick === null) return { day: i + 1, rest: true, steps: [] };
    const skill = skills[pick] ?? skills[0]!;
    const habit = habitResource(skill, plan.map);
    return {
      day: i + 1,
      rest: false,
      focus: skill,
      steps: [
        // The full demo review on the first day of each block; a short one otherwise.
        { step: "review", minutes: i === 0 ? STEP_MINUTES.review : 10 },
        {
          step: "warmup",
          minutes: STEP_MINUTES.warmup,
          skill: skill === "spray" ? "spray" : "aim",
          resourceId: skill === "spray" ? "recoil-master" : "aim-botz",
        },
        {
          step: "habit",
          minutes: STEP_MINUTES.habit,
          skill,
          ...(habit ? { resourceId: habit } : {}),
        },
        { step: "focus", minutes: STEP_MINUTES.focus, skill },
        { step: "debrief", minutes: STEP_MINUTES.debrief },
      ],
    };
  });
}
