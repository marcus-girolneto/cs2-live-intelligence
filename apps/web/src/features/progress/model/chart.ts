import type { Progress } from "@/features/maps";
export const CHART = [
  "adr",
  "kast",
  "openingSuccess",
  "tradedDeaths",
  "headshotPercentage",
] as const;

/** The learned profile part of GET coach/progress. */
export type Profile = NonNullable<Progress["profile"]>;
