/**
 * Curated CS2 practice resources (Steam Workshop maps and official modes) grouped by skill.
 * Workshop ids are NEVER invented: every `workshopId` must have a passing record in
 * `catalog.verified.json`, written by `pnpm training:verify` from Steam's public
 * ISteamRemoteStorage/GetPublishedFileDetails (title, app 730, not banned). A unit test fails
 * when an entry has no verified record.
 */
export const TRAINING_SKILLS = [
  "aim",
  "crosshair",
  "utility",
  "spray",
  "movement",
  "positioning",
] as const;
export type TrainingSkill = (typeof TRAINING_SKILLS)[number];

/** Active-duty style map names used by the per-map series. */
export const PRACTICE_MAPS = [
  "de_ancient",
  "de_anubis",
  "de_dust2",
  "de_inferno",
  "de_mirage",
  "de_nuke",
  "de_overpass",
  "de_train",
  "de_vertigo",
] as const;
export type PracticeMap = (typeof PRACTICE_MAPS)[number];

export type CatalogEntry = {
  id: string;
  skill: TrainingSkill;
  /** Display title (English; the Workshop item keeps its own title). */
  title: string;
  kind: "workshop" | "official";
  /** Steam Workshop published file id (verified, see catalog.verified.json). */
  workshopId?: string;
  /** Title the Workshop item must have (checked by the verifier). */
  workshopTitle?: string;
  /** Official map to load for "official" entries (e.g. de_mirage). */
  mapName?: string;
  /** Maps this resource trains (absent: any map). */
  maps?: PracticeMap[];
  /** https://steamcommunity.com page or steam:// link only (see links.ts). */
  url: string;
  minutesPerSession: number;
  /** Short steps (English source strings; the web translates them). */
  howTo: string[];
  tags: string[];
};

const workshopUrl = (id: string) =>
  `https://steamcommunity.com/sharedfiles/filedetails/?id=${id}`;
const STEAM_CS2 = "steam://rungameid/730";

const HOW = {
  aimBotz: [
    "Stand still, AK-47 or M4: 100 kills aiming at head height only.",
    "Then 100 kills with counter-strafes: stop before every shot.",
  ],
  reflex: [
    "Pick a short round and beat your previous score.",
    "Keep the crosshair at head height between targets.",
  ],
  warmup: [
    "One short round with your main rifle, then stop.",
    "Focus on first-bullet accuracy, not speed.",
  ],
  crosshairGen: [
    "Pick or tune a crosshair you can see on every map.",
    "Keep it: changing it every week costs consistency.",
  ],
  prefire: [
    "Pick the route you play in matches (your side and site).",
    "Run it twice on easy, then on the hardest difficulty.",
    "Clear every angle with your crosshair already at head height.",
  ],
  hub: [
    "Use the aim and prefire modes for 10 to 15 minutes.",
    "Pick one mode per session and track your score.",
  ],
  utilityMap: [
    "Choose your side and the site you play.",
    "Learn 2 smokes and 1 flash you can use next match.",
    "Throw each lineup 5 times in a row without help.",
  ],
  recoil: [
    "AK-47 and M4: spray the pattern at 10 m, then 20 m.",
    "Then spray-transfer between two bots.",
  ],
  movement: [
    "Practice counter-strafing: tap the opposite key, shoot only when stopped.",
    "Then jumps and routes you use in matches.",
  ],
  counterStrafe: [
    "Shoot only when fully stopped; watch the score per stop.",
    "Repeat until most stops are perfect.",
  ],
  deathmatch: [
    "Play one deathmatch with ONE objective (for example: headshots only, or counter-strafe every kill).",
    "Stop after 10 minutes; long unfocused deathmatch does not fix positioning or utility.",
  ],
  practiceServer: [
    "Play, then Practice, pick the map with bots off.",
    "Open the console and paste the practice config from this page.",
    "Use the teleports to rehearse your own spots.",
  ],
} satisfies Record<string, string[]>;

type Series = { map: PracticeMap; id: string; title: string };
const PREFIRE: Series[] = [
  { map: "de_mirage", id: "3267302800", title: "Mirage Prefire" },
  { map: "de_dust2", id: "3295650711", title: "Dust 2 Prefire" },
  { map: "de_inferno", id: "3289507717", title: "Inferno Prefire" },
  { map: "de_anubis", id: "3307639951", title: "Anubis Prefire" },
  { map: "de_nuke", id: "3318295422", title: "Nuke Prefire" },
  { map: "de_ancient", id: "3282067356", title: "Ancient Prefire" },
  { map: "de_vertigo", id: "3274138705", title: "Vertigo Prefire" },
  { map: "de_overpass", id: "3328383138", title: "Overpass Prefire" },
  { map: "de_train", id: "3562576256", title: "Train Prefire" },
];
const UTILITY: Series[] = [
  { map: "de_mirage", id: "3312981414", title: "Mirage Utility" },
  { map: "de_dust2", id: "3360435602", title: "Dust 2 Utility" },
  { map: "de_inferno", id: "3332771164", title: "Inferno Utility" },
  { map: "de_nuke", id: "3340925621", title: "Nuke Utility" },
  { map: "de_anubis", id: "3368313759", title: "Anubis Utility" },
  { map: "de_ancient", id: "3351615311", title: "Ancient Utility" },
  { map: "de_vertigo", id: "3323457022", title: "Vertigo Utility" },
  { map: "de_overpass", id: "3566472167", title: "Overpass Utility" },
  { map: "de_train", id: "3569811497", title: "Train Utility" },
];
const slug = (map: PracticeMap) => map.replace(/^de_/, "");

const workshop = (
  e: Omit<CatalogEntry, "kind" | "url" | "workshopTitle"> & {
    workshopId: string;
    workshopTitle?: string;
  },
): CatalogEntry => ({
  ...e,
  kind: "workshop",
  workshopTitle: e.workshopTitle ?? e.title,
  url: workshopUrl(e.workshopId),
});

export const TRAINING_CATALOG: readonly CatalogEntry[] = [
  // Aim
  workshop({
    id: "aim-botz",
    skill: "aim",
    title: "Aim Botz - Aim Training (CS2)",
    workshopId: "3070244462",
    minutesPerSession: 15,
    howTo: HOW.aimBotz,
    tags: ["warmup", "headshots", "classic"],
  }),
  workshop({
    id: "fast-aim-reflex",
    skill: "aim",
    title: "FAST AIM/REFLEX TRAINING [CS2]",
    workshopId: "3070758981",
    minutesPerSession: 10,
    howTo: HOW.reflex,
    tags: ["reflex", "flicks"],
  }),
  workshop({
    id: "aim-rush",
    skill: "aim",
    title: "Aim_Rush / Aim training map",
    workshopId: "3105821815",
    minutesPerSession: 10,
    howTo: HOW.reflex,
    tags: ["moving targets", "tracking"],
  }),
  workshop({
    id: "csstats-training",
    skill: "aim",
    title: "CSStats Training Map (CSGOHUB)",
    workshopId: "3070389038",
    minutesPerSession: 10,
    howTo: HOW.warmup,
    tags: ["warmup", "bots"],
  }),
  workshop({
    id: "fast-warmup",
    skill: "aim",
    title: "Fast Warmup: Bot Training",
    workshopTitle: "Fast Warmup — Bot Training",
    workshopId: "3083320026",
    minutesPerSession: 10,
    howTo: HOW.warmup,
    tags: ["warmup", "bots"],
  }),
  {
    id: "official-deathmatch",
    skill: "aim",
    title: "Deathmatch (official mode)",
    kind: "official",
    url: STEAM_CS2,
    minutesPerSession: 10,
    howTo: HOW.deathmatch,
    tags: ["official", "one objective"],
  },
  // Crosshair placement and prefire
  workshop({
    id: "crosshair-generator",
    skill: "crosshair",
    title: "crashz' Crosshair Generator v4",
    workshopId: "3070193546",
    minutesPerSession: 10,
    howTo: HOW.crosshairGen,
    tags: ["setup"],
  }),
  workshop({
    id: "yprac-hub",
    skill: "crosshair",
    title: "Yprac Hub by Yesber",
    workshopId: "3070715607",
    minutesPerSession: 15,
    howTo: HOW.hub,
    tags: ["prefire", "aim", "hub"],
  }),
  workshop({
    id: "refrag-hub",
    skill: "crosshair",
    title: "Refrag.gg - Aim, Movement, Crosshair, Prefire!",
    workshopId: "3416003536",
    minutesPerSession: 15,
    howTo: HOW.hub,
    tags: ["prefire", "movement", "hub"],
  }),
  ...PREFIRE.map((s) =>
    workshop({
      id: `prefire-${slug(s.map)}`,
      skill: "crosshair",
      title: s.title,
      workshopId: s.id,
      maps: [s.map],
      minutesPerSession: 15,
      howTo: HOW.prefire,
      tags: ["prefire", "routes", "head height"],
    }),
  ),
  // Utility
  ...UTILITY.map((s) =>
    workshop({
      id: `utility-${slug(s.map)}`,
      skill: "utility",
      title: s.title,
      workshopId: s.id,
      maps: [s.map],
      minutesPerSession: 15,
      howTo: HOW.utilityMap,
      tags: ["smokes", "flashes", "molotovs"],
    }),
  ),
  {
    id: "practice-server",
    skill: "utility",
    title: "Private practice server (official map + config)",
    kind: "official",
    url: STEAM_CS2,
    minutesPerSession: 15,
    howTo: HOW.practiceServer,
    tags: ["official", "lineups", "your spots"],
  },
  // Spray
  workshop({
    id: "recoil-master",
    skill: "spray",
    title: "Recoil Master - Spray Training (CS2)",
    workshopId: "3100869952",
    minutesPerSession: 10,
    howTo: HOW.recoil,
    tags: ["spray", "recoil"],
  }),
  // Movement
  workshop({
    id: "movement-hub",
    skill: "movement",
    title: "Movement Hub",
    workshopId: "3355497176",
    minutesPerSession: 10,
    howTo: HOW.movement,
    tags: ["movement", "jumps"],
  }),
  workshop({
    id: "counter-strafe-master",
    skill: "movement",
    title: "Counter-strafe Master",
    workshopId: "3667395967",
    minutesPerSession: 10,
    howTo: HOW.counterStrafe,
    tags: ["counter-strafe"],
  }),
  // Positioning: your own spots on the official map (teleports) and Wingman.
  {
    id: "your-spots",
    skill: "positioning",
    title: "Your spots on a practice server",
    kind: "official",
    url: STEAM_CS2,
    minutesPerSession: 15,
    howTo: HOW.practiceServer,
    tags: ["official", "teleports", "angles"],
  },
];

export const catalogEntry = (id: string): CatalogEntry | undefined =>
  TRAINING_CATALOG.find((e) => e.id === id);

/** The per-map entry of a series ("prefire" or "utility") for an analysis map. */
export function mapEntry(
  series: "prefire" | "utility",
  map: string | undefined,
): CatalogEntry | undefined {
  if (!map) return undefined;
  const key = map.toLowerCase().replace(/^de_/, "");
  return catalogEntry(`${series}-${key}`);
}
