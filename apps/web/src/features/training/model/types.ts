/** Training view models (normalised from the API by ./normalize). */
export type Skill =
  "aim" | "crosshair" | "utility" | "spray" | "movement" | "positioning";
export const SKILLS: readonly Skill[] = [
  "aim",
  "crosshair",
  "utility",
  "spray",
  "movement",
  "positioning",
];
export type Step = "review" | "warmup" | "habit" | "focus" | "debrief";
export type TeleportKind =
  "death" | "enemy" | "lineup" | "teamflash" | "crosshair";

export type Resource = {
  id: string;
  skill: Skill;
  title: string;
  kind: "workshop" | "official";
  workshopId: string | null;
  maps: string[];
  minutes: number;
  howTo: string[];
  tags: string[];
  steamUrl: string | null;
  webUrl: string | null;
  launchUrl: string;
  command: string | null;
  subscriptions: number | null;
};
export type Clip = {
  round: number;
  from: number;
  to: number;
  focusSteamId: string;
  eventIds: string[];
  label?: string;
};
export type Session = {
  id: string;
  step: Step;
  skill: Skill | null;
  code: string;
  params: Record<string, string | number>;
  title: string;
  why: string;
  criteria: string;
  minutes: number;
  resourceIds: string[];
  teleportIds: string[];
  clips: Clip[];
};
export type Teleport = {
  id: string;
  kind: TeleportKind;
  round: number | null;
  callout: string | null;
  grenade: string | null;
  command: string;
  botPlace: string | null;
  crouched: boolean;
  approximate: boolean;
  x: number;
  y: number;
};
export type Plan = {
  map: string | null;
  side: "CT" | "T" | null;
  area: string | null;
  role: string | null;
  focus: Skill[];
  mindset: string;
  mindsetCode: Skill | null;
  sessions: Session[];
  practiceConfig: string[];
  serverSetup: string[];
  teleports: Teleport[];
  caveats: string[];
};
export type DayStep = {
  step: Step;
  minutes: number;
  skill: Skill | null;
  resourceId: string | null;
};
export type PracticeDay = {
  day: number;
  rest: boolean;
  focus: Skill | null;
  steps: DayStep[];
};
export type Catalog = { verifiedAt: string | null; resources: Resource[] };
export type Recommended = {
  steamId: string | null;
  latest: {
    analysisId: string;
    createdAt: string | null;
    map: string | null;
    plan: Plan;
  } | null;
  focus: Skill[];
  week: PracticeDay[];
};
/** A clip in the replay player's shape (ClipRef of the replay feature). */
export type PlayClip = {
  round: number;
  from: number;
  to: number;
  steamId: string;
  eventIds: string[];
  label?: string;
};
export type OnPlay = (clip: PlayClip, title: string) => void;
