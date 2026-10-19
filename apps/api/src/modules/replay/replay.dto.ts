import { z } from "zod";

/** Replay artifact written by the demo parser (`-replay`, version replay-1), gzipped JSON. */
const num = z.number().finite();
const int = z.number().int();
const xy = z.tuple([num, num]);
export const replayTrackSchema = z.object({
  p: int.nonnegative(),
  team: z.string().max(16).optional(),
  x: z.array(num),
  y: z.array(num),
  yaw: z.array(int),
  hp: z.array(int),
  armor: z.array(int),
  w: z.array(int),
  fl: z.array(int),
  alive: z.array(int),
});
export const replayRoundSchema = z.object({
  number: int.positive(),
  freezeTick: int.nonnegative(),
  duration: num.nonnegative(),
  winner: z.enum(["CT", "T"]).optional(),
  t: z.array(num),
  tracks: z.array(replayTrackSchema).max(128),
  shots: z.array(z.tuple([num, num, num, num, num, num])),
  grenades: z.array(
    z.object({
      type: z.string().max(16),
      p: int.nonnegative(),
      t0: num,
      from: xy,
      t1: num,
      to: xy,
      path: z.array(xy).max(64).optional(),
    }),
  ),
  bomb: z
    .array(
      z.object({
        t: num,
        action: z.string().max(16),
        p: int,
        pos: xy,
        site: z.string().max(4).optional(),
      }),
    )
    .optional(),
});
export const replayArtifactSchema = z.object({
  version: z.literal("replay-1"),
  map: z.string().max(128).optional(),
  tickRate: num.positive(),
  sampleHz: int.positive(),
  players: z
    .array(
      z.object({
        steamId: z.string().max(64),
        name: z.string().max(128).optional(),
      }),
    )
    .max(128),
  weapons: z.array(z.string().max(64)).max(256),
  rounds: z.array(replayRoundSchema).max(1000),
  bounds: z.object({ minX: num, maxX: num, minY: num, maxY: num }).optional(),
  cell: int.positive(),
  outline: z.array(int),
});
export type ReplayArtifact = z.infer<typeof replayArtifactSchema>;
export type ReplayRound = z.infer<typeof replayRoundSchema>;

/** Longest window one request may return, in seconds. */
export const MAX_WINDOW_SECONDS = 40;
const seconds = z.coerce.number().finite().min(0).max(3600);
export const replayParamsSchema = z.object({
  id: z.string().uuid(),
});
export const replayWindowQuerySchema = z
  .object({
    round: z.coerce.number().int().min(1).max(1000),
    from: seconds.optional(),
    to: seconds.optional(),
  })
  .strict()
  .refine((q) => q.from === undefined || q.to === undefined || q.to > q.from, {
    message: "to must be greater than from",
  });
export type ReplayWindowQuery = z.infer<typeof replayWindowQuerySchema>;

export type ReplayPlayerDto = { steamId: string; name?: string; team?: string };
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
