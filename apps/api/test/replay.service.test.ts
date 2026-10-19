import { describe, expect, it } from "vitest";
import { ReplayService } from "../src/modules/replay/replay.service.js";
import type { ReplayRepository } from "../src/modules/replay/replay.repository.js";
import type { ReplayStorage } from "../src/infrastructure/storage/replay-storage.js";
import type { ReplayArtifact } from "../src/modules/replay/replay.dto.js";
import { replayWindowQuerySchema } from "../src/modules/replay/replay.dto.js";
import { syntheticAnalysis, syntheticReplay } from "./replay-fixtures.js";
import { NotFoundError } from "../src/shared/errors/index.js";

function service(replay: ReplayArtifact | null = syntheticReplay()) {
  const repository: ReplayRepository = {
    ownedAnalysis: async (owner, id) =>
      owner === "owner" && id === "job"
        ? { analysis: syntheticAnalysis }
        : undefined,
  };
  const storage: ReplayStorage = {
    pathFor: (id) => `/tmp/${id}`,
    read: async (id) => (id === "job" ? (replay ?? undefined) : undefined),
    remove: async () => undefined,
  };
  return new ReplayService(repository, storage);
}

describe("replay service", () => {
  it("builds meta with sides, first-round teams and outline pairs", async () => {
    const meta = await service().meta("owner", "job");
    expect(meta).toMatchObject({
      map: "de_test",
      tickRate: 64,
      sampleHz: 8,
      rounds: [{ number: 1, duration: 57, winner: "T", ct: ["b"], t: ["a"] }],
      players: [
        { steamId: "a", name: "Alpha", team: "T" },
        { steamId: "b", name: "Bravo", team: "CT" },
      ],
      bounds: { minX: 0, maxX: 600 },
      cell: 48,
      outline: [
        [24, 24],
        [72, 24],
      ],
    });
  });

  it("enforces ownership and replay availability", async () => {
    await expect(service().meta("other", "job")).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(service(null).meta("owner", "job")).rejects.toThrow(
      "Replay not available",
    );
    await expect(
      service().window("owner", "job", { round: 9 }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("returns a clamped window with frames and merged events", async () => {
    const w = await service().window("owner", "job", {
      round: 1,
      from: 45,
      to: 200,
    });
    expect(w.from).toBe(45);
    expect(w.to).toBe(60);
    expect(w.frames[0]!.t).toBe(45);
    expect(w.frames.at(-1)!.t).toBe(60);
    expect(w.frames.every((f) => f.t >= 45 && f.t <= 60)).toBe(true);
    const at51 = w.frames.find((f) => f.t === 51)!;
    expect(at51.p[1]).toEqual([1, 501, 100, 408 % 360, 0, 0, 0, 0, 100]);
    expect(w.players).toEqual([
      { steamId: "a", name: "Alpha", team: "T" },
      { steamId: "b", name: "Bravo", team: "CT" },
    ]);
    expect(w.weapons).toEqual(["AK-47", "M4A4"]);
    const kill = w.events.find((e) => e.type === "kill")!;
    expect(kill).toMatchObject({
      id: "ev_kill",
      t: 50,
      attacker: 0,
      victim: 1,
      headshot: true,
      victimPos: [501, 100],
      attackerPos: [500, 0],
    });
    expect(w.events.find((e) => e.type === "damage")).toMatchObject({
      id: "ev_dmg",
      t: 49,
      healthDamage: 27,
      hitgroup: "chest",
      victimPos: [491, 100],
    });
    expect(w.events.find((e) => e.type === "shot")).toMatchObject({
      t: 49.5,
      shooter: 0,
      x: 495,
      yaw: 90,
      weapon: "AK-47",
    });
    expect(w.events.map((e) => e.type)).not.toContain("grenade");
    expect(w.events.map((e) => e.t)).toEqual(
      [...w.events.map((e) => e.t)].sort((a, b) => a - b),
    );
    expect(w.events.some((e) => e.id === "ev_other")).toBe(false);
  });

  it("defaults to the first 40 s and includes grenades, flashes and bomb", async () => {
    const w = await service().window("owner", "job", { round: 1 });
    expect([w.from, w.to]).toEqual([0, 40]);
    expect(w.events.find((e) => e.type === "grenade")).toMatchObject({
      t: 4,
      grenade: "flash",
      thrower: 0,
      from: [40, 0],
      to: [60, 50],
      detonateT: 5.5,
    });
    expect(w.events.find((e) => e.type === "flashed")).toMatchObject({
      id: "ev_flash",
      t: 5.5,
      durationSeconds: 1.2,
    });
    expect(w.events.find((e) => e.type === "bomb")).toMatchObject({
      id: "ev_bomb",
      action: "plant",
      player: 0,
      site: "A",
      pos: [300, 0],
    });
    const late = await service().window("owner", "job", {
      round: 1,
      from: 10,
      to: 90,
    });
    expect([late.from, late.to]).toEqual([10, 50]);
  });

  it("validates window query parameters", () => {
    const ok = (q: Record<string, string | undefined>) =>
      replayWindowQuerySchema.safeParse(q).success;
    expect(ok({ round: "3", from: "1.5", to: "20" })).toBe(true);
    expect(ok({ round: "3" })).toBe(true);
    for (const q of [
      {},
      { round: "0" },
      { round: "x" },
      { round: "1.5" },
      { round: "1", from: "-1" },
      { round: "1", from: "10", to: "5" },
      { round: "1", to: "abc" },
      { round: "1", extra: "1" },
    ])
      expect(ok(q)).toBe(false);
  });
});
