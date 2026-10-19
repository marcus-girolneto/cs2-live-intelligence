import type { Analysis, DemoEvent, PlayerDetail } from "@cs2/contracts";
import type { WeaponClass } from "@/shared/format";

export type Player = Analysis["players"][number];
export type Kill = Extract<DemoEvent, { type: "kill" }>;
export type Damage = Extract<DemoEvent, { type: "damage" }>;
export type Shot = Extract<DemoEvent, { type: "shot" }>;
export type Detail = Player["detail"];

export type BodyRegion = "head" | "chest" | "stomach" | "arms" | "legs";
export const BODY_REGIONS: BodyRegion[] = [
  "head",
  "chest",
  "stomach",
  "arms",
  "legs",
];

export type WeaponRow = {
  weapon: string;
  name: string;
  cls: WeaponClass;
  kills: number;
  headshots: number;
  damage: number;
  shots: number | null;
  hits: number | null;
  accuracy: number | null;
  hsRate: number | null;
};
export type PlaceRow = {
  place: string;
  kills: number;
  deaths: number;
  damage: number;
};
export type Marker = {
  kind: "kill" | "death";
  round: number;
  x: number;
  y: number;
  /** The other player's position (victim for kills, killer for deaths) when known. */
  other?: { x: number; y: number };
  place?: string;
  weapon?: string;
  headshot?: boolean;
  side?: "CT" | "T";
  eventId: string;
};
export type Timing = NonNullable<PlayerDetail["timing"]>;
export type Utility = NonNullable<PlayerDetail["utility"]>;
export type Economy = NonNullable<PlayerDetail["economy"]>;
export type Insight = {
  shots: number | null;
  hits: number | null;
  accuracy: number | null;
  hitgroups: Record<BodyRegion, number> | null;
  hitTotal: number;
  weapons: WeaponRow[];
  places: PlaceRow[];
  markers: Marker[];
  timing: Timing | null;
  utility: Utility | null;
  economy: Economy | null;
  avgKillDistance: number | null;
  /** True when anything beyond the basic 1.0 metrics is available. */
  rich: boolean;
};

/** Events of one player, pre-filtered once and shared by every breakdown. */
export type PlayerEvents = {
  id: string;
  events: DemoEvent[];
  kills: Kill[];
  deaths: Kill[];
  damage: Damage[];
  shots: Shot[];
};

export const pct = (a: number | null, b: number | null) =>
  a === null || b === null || b <= 0 ? null : (a / b) * 100;
export const sideOf = (t: unknown) => (t === "CT" || t === "T" ? t : undefined);
export const avg = (v: number[]) =>
  v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
