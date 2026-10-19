export type ReplayPlayerDto = { steamId: string; name?: string; team?: string };
/** GET /v1/analyses/:id/replay/meta. */
export type ReplayMetaDto = {
  map: string | null;
  tickRate: number;
  sampleHz: number;
  rounds: {
    number: number;
    duration: number;
    winner: "CT" | "T" | null;
    ct: string[];
    t: string[];
  }[];
  players: ReplayPlayerDto[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number } | null;
  cell: number;
  outline: [number, number][];
};
/** [playerIndex, x, y, yaw, hp, alive(0|1), weaponIndex(-1 = none), flashed(0|1), armor]. */
export type ReplayFrameRow = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];
export type ReplayEventDto = { t: number; type: string } & Record<
  string,
  unknown
>;
/** GET /v1/analyses/:id/replay?round=&from=&to= (window of at most 40 s). */
export type ReplayWindowDto = {
  round: number;
  sampleHz: number;
  from: number;
  to: number;
  duration: number;
  winner: "CT" | "T" | null;
  players: ReplayPlayerDto[];
  weapons: string[];
  frames: { t: number; p: ReplayFrameRow[] }[];
  events: ReplayEventDto[];
};
