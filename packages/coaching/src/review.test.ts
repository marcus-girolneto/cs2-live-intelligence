import { unwrapData } from "./security.js";
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { analyzeDemo } from "@cs2/analytics";
import { coachingSchema, type Analysis } from "@cs2/contracts";
import {
  aiCoaching,
  buildReview,
  clipsFor,
  historyForMap,
  insightClips,
  learnProfile,
  loadAiConfig,
  momentCandidates,
  plansForMap,
  playerScores,
  scoreLabel,
  POST_MATCH_SYSTEM_PROMPT,
  LIVE_SYSTEM_PROMPT,
  aiLiveCall,
  type AiConfig,
} from "./index.js";

const enriched = () =>
  analyzeDemo(
    JSON.parse(
      readFileSync(
        new URL(
          "../../contracts/fixtures/normalized-demo-enriched.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ),
  );
const config = (): AiConfig => {
  const r = loadAiConfig({
    AI_PROVIDER: "openrouter",
    AI_API_KEY: "sk-test",
    AI_MODEL: "vendor/secret-model",
  });
  if (!r.ok) throw new Error(r.reason);
  return r.config;
};
type Payload = {
  facts: { id: string; kind: string }[];
  momentCandidates?: { id: string; kind: string }[];
  playerHistory?: { overall: unknown; thisMap?: { map: string } };
  previousPlans?: { general: { text: string }[]; thisMap: { text: string }[] };
};
function fake(answer: (p: Payload) => unknown, seen: Payload[] = []) {
  return (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as {
      model: string;
      messages: { content: string }[];
    };
    const user = body.messages[1]!.content;
    const payload = unwrapData(user) as Payload;
    seen.push(payload);
    return new Response(
      JSON.stringify({
        model: body.model,
        choices: [
          {
            finish_reason: "stop",
            message: { content: JSON.stringify(answer(payload)) },
          },
        ],
      }),
    );
  }) as unknown as typeof fetch;
}

describe("deterministic scores", () => {
  it("rates each dimension against the lobby and documents the basis", () => {
    const a = enriched();
    const scores = playerScores(a, "a")!;
    expect(scores).toBeDefined();
    for (const s of Object.values(scores)) {
      expect(s!.value).toBeGreaterThanOrEqual(0);
      expect(s!.value).toBeLessThanOrEqual(100);
      expect(s!.label).toBe(scoreLabel(s!.value));
      expect(s!.basis).toMatch(/lobby/);
    }
    // Deterministic.
    expect(playerScores(a, "a")).toEqual(scores);
    // The lobby average sits around 50: scores across players are spread around it.
    const impact = a.players
      .map((p) => playerScores(a, p.steamId)?.impact?.value)
      .filter((v): v is number => v !== undefined);
    expect(impact.length).toBeGreaterThan(1);
    expect(Math.min(...impact)).toBeLessThan(50);
    expect(Math.max(...impact)).toBeGreaterThan(50);
  });
  it("omits dimensions whose data is incomplete or whose lobby is too small", () => {
    const a = enriched();
    const incomplete: Analysis = {
      ...a,
      players: a.players.map((p) => ({
        ...p,
        adr: { ...p.adr, complete: false },
        advanced: Object.fromEntries(
          Object.entries(p.advanced ?? {}).map(([k, m]) => [
            k,
            { ...m, complete: false },
          ]),
        ),
      })),
    };
    const s = playerScores(incomplete, "a");
    expect(s?.impact).toBeUndefined();
    expect(s?.utility).toBeUndefined();
    const tiny: Analysis = { ...a, players: a.players.slice(0, 2) };
    expect(playerScores(tiny, "a")).toBeUndefined();
    expect(playerScores(a, "nobody")).toBeUndefined();
  });
  it("labels by fixed thresholds", () => {
    expect([10, 30, 50, 60, 80].map(scoreLabel)).toEqual([
      "poor",
      "below",
      "average",
      "good",
      "elite",
    ]);
  });
});

describe("clips", () => {
  it("windows [t-7, t+2] clamped to the round and merges overlaps", () => {
    const a = enriched();
    const kills = (a.events ?? []).filter(
      (e) => e.type === "kill" && e.round === 1,
    ) as (NonNullable<Analysis["events"]>[number] & { roundTime: number })[];
    const clips = clipsFor(a, kills, "a");
    expect(clips.length).toBeGreaterThan(0);
    for (const c of clips) {
      expect(c.from).toBeGreaterThanOrEqual(0);
      expect(c.to).toBeGreaterThan(c.from);
      expect(c.round).toBe(1);
    }
    // Kills at 10 s and 18 s overlap ([3,12] and [11,20]) and merge into one clip.
    expect(clips[0]!.from).toBe(3);
    expect(clips[0]!.eventIds).toEqual(
      expect.arrayContaining(["kill9", "kill10"]),
    );
  });
  it("prefers the player's deaths for improvements and kills for strengths", () => {
    const a = enriched();
    const evidence = a.players.find((p) => p.steamId === "a")!.deaths
      .evidenceIds;
    const kills = a.players.find((p) => p.steamId === "a")!.kills.evidenceIds;
    const improve = insightClips(a, [...kills, ...evidence], "a", "improve");
    const strength = insightClips(a, [...evidence, ...kills], "a", "strength");
    const byId = new Map((a.events ?? []).map((e) => [e.id, e]));
    const first = (ids: string[]) => byId.get(ids[0]!) as { victimId?: string };
    expect(improve.length).toBeGreaterThan(0);
    expect(improve.length).toBeLessThanOrEqual(3);
    expect(first(improve[0]!.eventIds).victimId).toBe("a");
    expect(first(strength[0]!.eventIds).victimId).not.toBe("a");
  });
});

describe("key-moment candidates", () => {
  it("lists the player's kills and deaths with context", () => {
    const a = enriched();
    const c = momentCandidates(a, "a");
    expect(c.length).toBeGreaterThan(0);
    const death = c.find((x) => x.id === "kill10")!;
    expect(death).toMatchObject({
      kind: "death",
      round: 1,
      time: 18,
      yourPlace: "TopofMid",
      enemyPlace: "Middle",
      weapon: "Glock-18",
    });
    expect(death.situation).toMatch(/^\dv\d$/);
    expect(c.find((x) => x.id === "kill9")).toMatchObject({
      kind: "kill",
      opening: true,
    });
  });
});

describe("v5 review building", () => {
  it("validates moments, scopes items, attaches clips and scores", () => {
    const a = enriched();
    const candidates = momentCandidates(a, "a");
    const facts = new Set(a.evidence.map((e) => e.id));
    const place = a.evidence.find((e) => e.kind.startsWith("place-"));
    const metric = a.players.find((p) => p.steamId === "a")!.deaths
      .evidenceIds[0]!;
    const review = buildReview(
      {
        verdict: "x".repeat(200),
        summary: "Short.",
        insights: [
          {
            observation: "You died at TopofMid.",
            evidenceIds: [place?.id ?? metric],
            confidence: "medium",
            actionablePractice: "Hold with a teammate.",
            caveats: [],
            kind: "improve",
            scope: "general",
          },
          {
            observation: "Fake.",
            evidenceIds: ["made-up"],
            confidence: "high",
            actionablePractice: "x",
            caveats: [],
            kind: "improve",
            scope: "general",
          },
        ],
        keyMoments: [
          {
            eventId: candidates[0]!.id,
            title: "Opening pick",
            whatHappened: "You won the opening duel.",
            whatToDoInstead: "Repeat it.",
            kind: "highlight",
            scope: "map",
          },
          {
            eventId: candidates[1]!.id,
            title: "Wrong round",
            whatHappened: `Round ${candidates[1]!.round + 5}: you died.`,
            whatToDoInstead: "y",
            kind: "mistake",
            scope: "general",
          },
          {
            eventId: "not-a-candidate",
            title: "Invented",
            whatHappened: "x",
            whatToDoInstead: "y",
            kind: "mistake",
            scope: "general",
          },
        ],
        drills: [
          {
            name: "Aim Botz",
            durationMinutes: 500,
            howTo: "100 kills.",
            metric: "accuracy",
            scope: "general",
          },
          { name: "Missing parts" },
        ],
        plan: [
          { text: "Trade your entry", scope: "general" },
          { text: "Avoid dry peeks at TopofMid", scope: "map" },
        ],
      },
      a,
      {
        focusSteamId: "a",
        lang: "en",
        candidateIds: candidates,
        allowedFacts: facts,
        model: "vendor/secret-model",
      },
    );
    const parsed = coachingSchema.parse(review);
    expect(parsed.verdict).toHaveLength(90);
    expect(parsed.map).toBe("de_mirage");
    expect(parsed.insights).toHaveLength(1);
    if (place) expect(parsed.insights[0]!.scope).toBe("map");
    expect(parsed.keyMoments).toHaveLength(1);
    expect(parsed.keyMoments![0]!.clip).toMatchObject({
      round: candidates[0]!.round,
      focusSteamId: "a",
      eventIds: [candidates[0]!.id],
    });
    expect(parsed.drills).toEqual([
      expect.objectContaining({ durationMinutes: 120, scope: "general" }),
    ]);
    expect(parsed.drills![0]!.map).toBeUndefined();
    expect(parsed.plan).toEqual([
      "Trade your entry",
      "Avoid dry peeks at TopofMid",
    ]);
    expect(parsed.planItems).toEqual([
      {
        text: "Trade your entry",
        scope: "general",
        targetMetric: "tradedDeathsPct",
        direction: "up",
      },
      {
        text: "Avoid dry peeks at TopofMid",
        scope: "map",
        map: "de_mirage",
        targetMetric: "none",
        direction: "up",
      },
    ]);
    expect(parsed.scores).toEqual(playerScores(a, "a"));
    expect(parsed.caveats.join(" ")).toContain("1 AI point");
  });
  it("accepts the v4 shape and omitted optional parts", () => {
    const a = enriched();
    const id = a.players[0]!.adr.evidenceIds[0]!;
    const review = buildReview(
      {
        summary: "Old.",
        insights: [
          {
            observation: "o",
            evidenceIds: [id],
            confidence: "low",
            actionablePractice: "p",
            caveats: [],
          },
        ],
        plan: ["Legacy item"],
      },
      a,
      {
        lang: "en",
        candidateIds: [],
        allowedFacts: new Set([id]),
      },
    );
    const parsed = coachingSchema.parse(review);
    expect(parsed.planItems).toEqual([
      {
        text: "Legacy item",
        scope: "general",
        targetMetric: "none",
        direction: "up",
      },
    ]);
    expect(parsed.keyMoments).toBeUndefined();
    expect(parsed.drills).toBeUndefined();
    expect(parsed.verdict).toBeUndefined();
  });
  it("runs end to end through the provider with candidates and scoped history", async () => {
    const a = enriched();
    const seen: Payload[] = [];
    const other: Analysis = { ...a, map: "de_inferno" };
    const history = learnProfile(
      [
        { analysis: a, createdAt: "2026-01-02T00:00:00Z" },
        { analysis: other, createdAt: "2026-01-01T00:00:00Z" },
      ],
      "a",
    );
    const r = await aiCoaching(a, config(), {
      focusSteamId: "a",
      fetch: fake((p) => {
        const fact = p.facts[0]!.id;
        const moment = p.momentCandidates![0]!.id;
        return {
          verdict: "Strong openings; trade your deaths.",
          summary: "s",
          insights: [
            {
              observation: "o",
              evidenceIds: [fact],
              confidence: "medium",
              actionablePractice: "p",
              caveats: [],
              kind: "improve",
              scope: "general",
            },
          ],
          keyMoments: [
            {
              eventId: moment,
              title: "t",
              whatHappened: "w",
              whatToDoInstead: "i",
              kind: "mistake",
              scope: "map",
            },
          ],
          drills: [],
          plan: [{ text: "Trade", scope: "general" }],
        };
      }, seen),
      personal: {
        preferences: {
          style: "balanced",
          tone: "direct",
          detail: "standard",
          role: "auto",
          focusAreas: [],
          instructions: "",
        },
        history,
        previousPlans: [
          {
            date: "2026-01-01",
            map: "de_inferno",
            items: [
              { text: "Smoke Banana early", scope: "map", map: "de_inferno" },
              { text: "Crosshair at head height", scope: "general" },
            ],
          },
          {
            date: "2026-01-02",
            map: "de_mirage",
            items: [{ text: "Hold Connector with a trade", scope: "map" }],
          },
        ],
      },
    });
    const sent = seen[0]!;
    expect(sent.momentCandidates!.length).toBeGreaterThan(0);
    expect(sent.playerHistory!.thisMap!.map).toBe("de_mirage");
    expect(JSON.stringify(sent.playerHistory)).not.toContain('de_inferno":{');
    expect(sent.previousPlans!.general.map((p) => p.text)).toEqual([
      "Crosshair at head height",
    ]);
    expect(sent.previousPlans!.thisMap.map((p) => p.text)).toEqual([
      "Hold Connector with a trade",
    ]);
    expect(JSON.stringify(sent)).not.toContain("Smoke Banana");
    expect(r.coaching.keyMoments).toHaveLength(1);
    expect(r.coaching.verdict).toBe("Strong openings; trade your deaths.");
    expect(r.coaching.scores).toBeDefined();
    expect(r.coaching.provenance?.promptVersion).toBe("igl-review-v10");
  });
});

describe("map-scoped learning", () => {
  const a = enriched();
  const inferno: Analysis = { ...a, map: "de_inferno" };
  const profile = learnProfile(
    [
      { analysis: a, createdAt: "2026-01-03T00:00:00Z" },
      { analysis: inferno, createdAt: "2026-01-02T00:00:00Z" },
      { analysis: a, createdAt: "2026-01-01T00:00:00Z" },
    ],
    "a",
  )!;
  it("learns per map with places", () => {
    expect(Object.keys(profile.perMap!).sort()).toEqual([
      "de_inferno",
      "de_mirage",
    ]);
    expect(profile.perMap!.de_mirage).toMatchObject({
      matches: 2,
      lastPlayedAt: "2026-01-03T00:00:00Z",
    });
    expect(profile.perMap!.de_mirage!.places.length).toBeGreaterThan(0);
  });
  it("feeds only the overall profile plus this map", () => {
    const h = historyForMap(profile, "de_mirage")!;
    expect(h.thisMap?.map).toBe("de_mirage");
    expect("perMap" in h.overall).toBe(false);
    expect(historyForMap(profile, "de_mirage", false)!.thisMap).toBeUndefined();
    expect(historyForMap(profile, "de_nuke")!.thisMap).toBeUndefined();
  });
  it("never feeds other maps' map-scoped plan items", () => {
    const plans = [
      {
        date: "d1",
        map: "de_inferno",
        items: [
          { text: "inferno item", scope: "map" as const, map: "de_inferno" },
          { text: "general item", scope: "general" as const },
        ],
      },
      {
        date: "d2",
        map: "de_mirage",
        items: [{ text: "mirage item", scope: "map" as const }],
      },
    ];
    expect(plansForMap(plans, "de_mirage")).toEqual({
      general: [{ date: "d1", text: "general item" }],
      thisMap: [{ date: "d2", text: "mirage item" }],
    });
    expect(plansForMap(plans, "de_mirage", false).thisMap).toEqual([]);
    expect(plansForMap(plans, null).thisMap).toEqual([]);
  });
});

describe("model identity is never revealed", () => {
  it("both prompts forbid naming the model or provider", () => {
    for (const p of [POST_MATCH_SYSTEM_PROMPT, LIVE_SYSTEM_PROMPT])
      expect(p).toMatch(/Never mention, confirm, deny or speculate/);
  });
  it("the live call receives map-scoped history only", async () => {
    const a = enriched();
    const seen: Payload[] = [];
    const profile = learnProfile(
      [
        { analysis: a, createdAt: "2026-01-02T00:00:00Z" },
        { analysis: { ...a, map: "de_inferno" }, createdAt: "2026-01-01" },
      ],
      "a",
    );
    await aiLiveCall({ map: "de_inferno", phase: "freezetime" }, config(), {
      fetch: fake(
        () => ({ call: "c", why: "w", focus: "trade", confidence: "low" }),
        seen,
      ),
      personal: {
        preferences: {
          style: "balanced",
          tone: "direct",
          detail: "standard",
          role: "auto",
          focusAreas: [],
          instructions: "",
        },
        history: profile,
        previousPlans: [
          {
            date: "d",
            map: "de_mirage",
            items: [{ text: "mirage-only", scope: "map", map: "de_mirage" }],
          },
        ],
      },
    });
    expect(seen[0]!.playerHistory!.thisMap!.map).toBe("de_inferno");
    expect(JSON.stringify(seen[0])).not.toContain("mirage-only");
  });
});
