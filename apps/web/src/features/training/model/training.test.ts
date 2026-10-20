import { describe, expect, it } from "vitest";
import catalogJson from "./fixtures/catalog.json";
import planJson from "./fixtures/training-plan.json";
import { sessionCopy, teleportLabel } from "./copy";
import { catalogMaps, filterResources } from "./filter";
import { isSafeTrainingUrl, safeCommand } from "./links";
import {
  normalizeCatalog,
  normalizePlan,
  normalizeRecommended,
} from "./normalize";

const t = (s: string, v?: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (m, k: string) => (v && k in v ? String(v[k]) : m));
const place = (p: string) => p;

describe("training links", () => {
  it("accepts only steam:// and https://steamcommunity.com", () => {
    for (const ok of [
      "steam://rungameid/730",
      "steam://url/CommunityFilePage/3070244462",
      "https://steamcommunity.com/sharedfiles/filedetails/?id=3070244462",
    ])
      expect(isSafeTrainingUrl(ok), ok).toBe(true);
    for (const bad of [
      "http://steamcommunity.com/x",
      "https://steamcommunity.com.evil.example/",
      "javascript:alert(1)",
      "steam://rungameid/440",
      "steam://connect/10.0.0.1",
      "https://evil.example/",
      42,
    ])
      expect(isSafeTrainingUrl(bad), String(bad)).toBe(false);
    expect(safeCommand("setpos_exact 1 2 3; setang 0 0 0")).toBeTruthy();
    expect(safeCommand("a\nquit")).toBeNull();
  });
});

describe("normalize", () => {
  it("keeps the verified catalog and drops unsafe links", () => {
    const c = normalizeCatalog(catalogJson);
    expect(c.resources.length).toBeGreaterThanOrEqual(20);
    const botz = c.resources.find((r) => r.id === "aim-botz")!;
    expect(botz.steamUrl).toBe("steam://url/CommunityFilePage/3070244462");
    expect(botz.command).toBe("host_workshop_map 3070244462");
    const evil = normalizeCatalog({
      entries: [
        {
          id: "x",
          skill: "aim",
          title: "X",
          links: {
            steam: "javascript:alert(1)",
            web: "https://evil.example",
            launch: "steam://rungameid/1",
          },
        },
      ],
    }).resources[0]!;
    expect(evil.steamUrl).toBeNull();
    expect(evil.webUrl).toBeNull();
    expect(evil.launchUrl).toBe("steam://rungameid/730");
    expect(normalizeCatalog(null).resources).toEqual([]);
  });

  it("reads the real Mirage plan: ordered sessions, config and teleports", () => {
    const p = normalizePlan(planJson)!;
    expect(p.map).toBe("de_mirage");
    expect(p.sessions.map((s) => s.step)[0]).toBe("review");
    expect(p.sessions.at(-1)!.step).toBe("debrief");
    expect(p.practiceConfig[0]).toBe("sv_cheats 1");
    expect(p.teleports.length).toBeGreaterThan(5);
    for (const tp of p.teleports)
      expect(tp.command).toMatch(/^setpos_exact .+; setang .+ 0$/);
    expect(normalizePlan({ version: "x" })).toBeNull();
    expect(normalizeRecommended({}).latest).toBeNull();
  });
});

describe("copy", () => {
  it("has a template for every session code and never shows degrees", () => {
    const p = normalizePlan(planJson)!;
    for (const s of p.sessions) {
      const c = sessionCopy(s, t, place);
      expect(c.title).not.toMatch(/\{\w+\}/);
      expect(`${c.title} ${c.why} ${c.criteria}`).not.toMatch(/degree|°/);
      // The web template matches the API's English text.
      expect(c.title).toBe(s.title);
      expect(c.criteria).toBe(s.criteria);
    }
    for (const tp of p.teleports)
      expect(teleportLabel(tp, t, place)).not.toMatch(/\{\w+\}|degree/);
  });

  it("filters the catalog by skill and map", () => {
    const { resources } = normalizeCatalog(catalogJson);
    const mirage = filterResources(resources, "crosshair", "de_mirage");
    expect(mirage.some((r) => r.id === "prefire-mirage")).toBe(true);
    expect(mirage.some((r) => r.id === "prefire-dust2")).toBe(false);
    expect(filterResources(resources, "spray", "all").map((r) => r.id)).toEqual(
      ["recoil-master"],
    );
    expect(catalogMaps(resources)).toContain("de_dust2");
  });
});
