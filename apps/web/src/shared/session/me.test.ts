import { describe, expect, it } from "vitest";
import { loadMe, parseMe, saveMe } from "./me";

const memory = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
};

describe("me preference", () => {
  it("round-trips through storage", () => {
    const s = memory();
    const me = {
      analysisId: "a",
      steamId: "1",
      name: "n",
      kills: 3,
      deaths: 2,
      rounds: 10,
    };
    saveMe(me, s);
    expect(loadMe(s)).toEqual(me);
    saveMe(null, s);
    expect(loadMe(s)).toBeNull();
  });
  it("rejects malformed or non-finite values", () => {
    expect(parseMe("not json")).toBeNull();
    expect(parseMe(JSON.stringify({ steamId: "1" }))).toBeNull();
    expect(
      parseMe(
        JSON.stringify({
          analysisId: "a",
          steamId: "1",
          kills: "NaN",
          deaths: null,
        }),
      ),
    ).toMatchObject({ kills: null, deaths: null, rounds: null });
  });
  it("survives storage that throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadMe(broken)).toBeNull();
    expect(() => saveMe(null, broken)).not.toThrow();
  });
});
