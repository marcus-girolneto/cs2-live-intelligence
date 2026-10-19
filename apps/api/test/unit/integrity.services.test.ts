import { describe, expect, it } from "vitest";
import { SteamPlayerBans } from "../../src/infrastructure/steam/player-bans.js";
import {
  bannedAfterMatch,
  nextCheck,
} from "../../src/modules/integrity/ban-check.job.js";

const DAY = 24 * 3600_000;
const ids = (n: number) =>
  Array.from(
    { length: n },
    (_, i) => `765611980000${String(i).padStart(5, "0")}`,
  );

describe("Steam GetPlayerBans adapter", () => {
  it("batches 100 ids per call, caches for 24 h, spaces calls and never leaks the key", async () => {
    let now = 0;
    const urls: string[] = [];
    const slept: number[] = [];
    const bans = new SteamPlayerBans(
      async () => "secret-key",
      () =>
        (async (input: string | URL | Request) => {
          const url = new URL(String(input));
          urls.push(url.searchParams.get("steamids")!);
          return Response.json({
            players: url.searchParams
              .get("steamids")!
              .split(",")
              .map((SteamId) => ({
                SteamId,
                NumberOfVACBans: 0,
                NumberOfGameBans: 2,
                DaysSinceLastBan: 3,
              })),
          });
        }) as typeof fetch,
      () => now,
      async (ms) => {
        slept.push(ms);
        now += ms;
      },
    );
    const first = await bans.bans([...ids(150), "not-an-id"]);
    expect(urls.map((u) => u.split(",").length)).toEqual([100, 50]);
    expect(slept).toHaveLength(1);
    expect(first?.get(ids(1)[0]!)).toEqual({
      steamId: ids(1)[0],
      vacBans: 0,
      gameBans: 2,
      daysSinceLastBan: 3,
    });
    expect(first?.size).toBe(150);
    await bans.bans(ids(150));
    expect(urls).toHaveLength(2);
    now += DAY;
    await bans.bans(ids(1));
    expect(urls).toHaveLength(3);
    const failing = new SteamPlayerBans(
      async () => "secret-key",
      () => (async () => new Response("no", { status: 500 })) as typeof fetch,
    );
    await expect(failing.bans(ids(1))).rejects.toThrow(
      "Steam GetPlayerBans HTTP 500",
    );
    await expect(failing.bans(ids(1))).rejects.not.toThrow(/secret-key/);
    expect(
      await new SteamPlayerBans(async () => undefined).bans(ids(1)),
    ).toBeUndefined();
  });
});

describe("ban timing", () => {
  const uploaded = new Date("2026-10-01T00:00:00Z");
  it("flags only bans newer than the match", () => {
    const now = new Date("2026-10-11T00:00:00Z"); // 10 days after the upload
    expect(
      bannedAfterMatch(
        { vacBans: 1, gameBans: 0, daysSinceLastBan: 3 },
        uploaded,
        now,
      ),
    ).toBe(true);
    expect(
      bannedAfterMatch(
        { vacBans: 1, gameBans: 0, daysSinceLastBan: 10 },
        uploaded,
        now,
      ),
    ).toBe(false);
    expect(
      bannedAfterMatch(
        { vacBans: 0, gameBans: 0, daysSinceLastBan: 0 },
        uploaded,
        now,
      ),
    ).toBe(false);
  });
  it("re-checks 7 and 30 days after the upload, then stops", () => {
    expect(nextCheck(uploaded, new Date("2026-10-01T01:00:00Z"))).toEqual(
      new Date("2026-10-08T00:00:00Z"),
    );
    expect(nextCheck(uploaded, new Date("2026-10-09T00:00:00Z"))).toEqual(
      new Date("2026-10-31T00:00:00Z"),
    );
    expect(nextCheck(uploaded, new Date("2026-11-01T00:00:00Z"))).toBeNull();
  });
});
