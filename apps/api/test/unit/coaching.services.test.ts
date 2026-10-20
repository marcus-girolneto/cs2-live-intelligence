import { describe, expect, it } from "vitest";
import type { AiConfig, LiveCall } from "@cs2/coaching";
import { AiError } from "@cs2/coaching";
import type { Coaching } from "@cs2/contracts";
import type { AiGateway } from "../../src/infrastructure/ai/coaching-ai-gateway.js";
import type { CoachPlansRepository } from "../../src/modules/coaching/coach-plans.repository.js";
import { CoachPlansService } from "../../src/modules/coaching/coach-plans.service.js";
import type {
  NewLiveCall,
  NewReview,
} from "../../src/modules/coaching/coaching.dto.js";
import type { AnalysisHistory } from "../../src/modules/coaching/coaching.ports.js";
import type { CoachingRepository } from "../../src/modules/coaching/coaching.repository.js";
import {
  LiveCallService,
  liveMatchKey,
} from "../../src/modules/coaching/live-call.service.js";
import { PersonalizationService } from "../../src/modules/coaching/personalization.service.js";
import { ReviewService } from "../../src/modules/coaching/review.service.js";
import { ViewerPolicy } from "../../src/modules/coaching/viewer.policy.js";
import type { StoredSession } from "../../src/modules/telemetry/telemetry.repository.js";
import { silentLogger } from "../../src/shared/logging/logger.js";
import { InsufficientCreditsError } from "../../src/shared/errors/index.js";
import { analysisWith, appError, CountingReservation } from "./fakes.js";

class FakeCoaching implements CoachingRepository {
  savedReviews: NewReview[] = [];
  calls: NewLiveCall[] = [];
  steamId: string | null = null;
  async profile() {
    return {
      preferences: {},
      playerSteamId: this.steamId,
      linkedToSteam: false,
    };
  }
  async saveProfile() {}
  async saveReview(r: NewReview) {
    this.savedReviews.push(r);
    return "rev-1";
  }
  async reviews() {
    return [];
  }
  async rateReview(_o: string, id: string) {
    return id === "rev-1";
  }
  async saveLiveCall(c: NewLiveCall) {
    this.calls.push(c);
    return "call-1";
  }
  async liveCalls() {
    return [];
  }
  async matchReviews() {
    return this.savedReviews.map((r, i) => ({
      id: `rev-${i + 1}`,
      tier: r.tier,
      provider: r.provider,
      model: r.model,
      promptVersion: r.promptVersion,
      lang: r.lang,
      coaching: r.coaching,
      rating: null,
      creditsSpent: r.creditsSpent,
      createdAt: "2026-10-19T00:00:00.000Z",
    }));
  }
  async previousDeep() {
    return [];
  }
  async deepReviewsBetween() {
    return [];
  }
}
/** Credits fake: a hold that records commits/releases; `balance` limits reservations. */
class FakeCredits {
  balanceLeft = 10;
  commits: string[] = [];
  releases = 0;
  async reserve(_ownerId: string, tier: "quick" | "deep") {
    const cost = tier === "deep" ? 3 : 1;
    if (this.balanceLeft < cost)
      throw new InsufficientCreditsError({
        tier,
        needed: cost,
        balance: this.balanceLeft,
        packs: [],
        upgradeTo: "basic",
      });
    this.balanceLeft -= cost;
    return {
      tier,
      cost,
      commit: async (ref: string) => {
        this.commits.push(ref);
        return cost;
      },
      release: async () => {
        this.releases++;
        this.balanceLeft += cost;
      },
    };
  }
  async balance() {
    return this.balanceLeft;
  }
}
const noPlans: CoachPlansRepository = {
  previousPlans: async () => [],
  reviewPlans: async () => [],
};
const history: AnalysisHistory = {
  analysis: async (owner, id) =>
    owner === "o" && id === "a1"
      ? { id, analysis: analysisWith(["p1"]), coaching: null }
      : undefined,
  completedAnalyses: async () => [],
};
const CONFIG = { provider: "x", model: "m" } as AiConfig;
const META = {
  provider: "vendor",
  model: "secret-model",
  latencyMs: 5,
  attempts: 1,
};
const COACHING: Coaching = {
  schemaVersion: "1.0",
  mode: "provider",
  provenance: { promptVersion: "v9", model: "secret-model" },
  insights: [],
  caveats: [],
};

function setup(gatewayError?: Error, acquireError?: Error) {
  const coaching = new FakeCoaching();
  const review = new CountingReservation();
  const live = new CountingReservation();
  const sent: Parameters<AiGateway["review"]>[2][] = [];
  const credits = new FakeCredits();
  const replayReads: string[] = [];
  const gateway: AiGateway = {
    review: async (_a, _c, options) => {
      sent.push(options);
      if (gatewayError) throw gatewayError;
      return { coaching: COACHING, call: META };
    },
    monthlyReport: () => Promise.reject(new Error("unused")),
    personalCoach: () => Promise.reject(new Error("unused")),
    liveCall: async () => {
      if (gatewayError) throw gatewayError;
      return { call: { promptVersion: "live-1" } as LiveCall, meta: META };
    },
    connectivityCheck: () => Promise.reject(new Error("unused")),
  };
  const deps = [
    { reserveReview: async () => review, reserveLiveCall: async () => live },
    {
      perMapLearning: async () => true,
      deepHistory: async () => true,
      reel: async () => false,
    },
    {
      acquire: async () => {
        if (acquireError) throw acquireError;
        return CONFIG;
      },
    },
    gateway,
    silentLogger,
  ] as const;
  const personalization = new PersonalizationService(
    coaching,
    history,
    new CoachPlansService(noPlans),
  );
  const sessions = new Map<string, StoredSession>([
    [
      "s1",
      {
        ownerId: "o",
        deviceId: "d",
        state: {
          map: "de_dust2",
          phase: "freezetime",
          round: 3,
        } as unknown as StoredSession["state"],
      },
    ],
    [
      "s2",
      { ownerId: "other", deviceId: "d", state: {} as StoredSession["state"] },
    ],
  ]);
  return {
    coaching,
    review,
    live,
    credits,
    sent,
    replayReads,
    reviews: new ReviewService({
      coaching,
      history,
      personalization,
      quota: deps[0],
      credits,
      features: deps[1],
      ai: deps[2],
      gateway,
      replays: {
        read: async (id: string) => {
          replayReads.push(id);
          return undefined;
        },
      },
      logger: silentLogger,
    }),
    calls: new LiveCallService(
      coaching,
      { session: async (id) => sessions.get(id) },
      personalization,
      ...deps,
    ),
  };
}
const user = ViewerPolicy.for(false);
const admin = ViewerPolicy.for(true);

describe("ReviewService", () => {
  it("404s before reserving quota for unknown analyses or players", async () => {
    const s = setup();
    expect(
      (await appError(s.reviews.review("o", "zz", "p1", "en", user))).body,
    ).toEqual({ error: "Analysis not found" });
    expect(
      (await appError(s.reviews.review("o", "a1", "nobody", "en", user))).body,
    ).toEqual({ error: "Player not found" });
    expect(s.review.released).toBe(0);
  });
  it("stores the review and hides model identity from non-admins", async () => {
    const s = setup();
    const result = await s.reviews.review("o", "a1", "p1", "pt", user);
    expect(result.call).toEqual({ latencyMs: 5, attempts: 1 });
    expect((result.coaching as Coaching).provenance).toEqual({
      promptVersion: "v9",
    });
    expect(s.coaching.savedReviews[0]).toMatchObject({
      model: "secret-model",
      promptVersion: "v9",
      lang: "pt",
    });
    expect(s.review.released).toBe(0);
    const asAdmin = await s.reviews.review("o", "a1", "p1", "en", admin);
    expect(asAdmin.call).toEqual(META);
  });
  it("releases the quota when the model fails or AI is not available", async () => {
    const failed = setup(new AiError("timeout", "vendor timed out"));
    expect(
      await appError(failed.reviews.review("o", "a1", "p1", "en", user)),
    ).toMatchObject({
      status: 504,
      body: {
        code: "ai_timeout",
        error: "The AI coach took too long to answer. Try again in a moment.",
      },
    });
    expect(failed.review.released).toBe(1);
    const unavailable = setup(undefined, new Error("not configured"));
    await expect(
      unavailable.reviews.review("o", "a1", "p1", "en", user),
    ).rejects.toThrow("not configured");
    expect(unavailable.review.released).toBe(1);
  });
  it("charges credits after saving the review and returns the balance", async () => {
    const s = setup();
    const result = await s.reviews.review("o", "a1", "p1", "en", user);
    expect(result).toMatchObject({
      tier: "quick",
      creditsSpent: 1,
      balance: 9,
    });
    expect(s.credits.commits).toEqual(["rev-1"]);
    expect(s.coaching.savedReviews[0]).toMatchObject({
      tier: "quick",
      creditsSpent: 1,
    });
  });
  it("deep reviews compute the deep modules from the replay and call the deep tier", async () => {
    const s = setup();
    const result = await s.reviews.review("o", "a1", "p1", "en", user, "deep");
    expect(result).toMatchObject({ tier: "deep", creditsSpent: 3 });
    expect(s.replayReads).toEqual(["a1"]);
    expect(s.sent[0]!.tier).toBe("deep");
    expect(s.sent[0]!.deep?.deep.rounds).toBeDefined();
    const saved = await s.reviews.matchReviews("o", "a1", "p1", user);
    expect(saved).toMatchObject({ latest: { quick: null, deep: "rev-1" } });
  });
  it("402 insufficient_credits releases the daily reservation; model failures release credits", async () => {
    const poor = setup();
    poor.credits.balanceLeft = 0;
    expect(
      await appError(poor.reviews.review("o", "a1", "p1", "en", user)),
    ).toMatchObject({
      status: 402,
      body: {
        code: "insufficient_credits",
        needed: 1,
        balance: 0,
        upgradeTo: "basic",
      },
    });
    expect(poor.review.released).toBe(1);
    const failed = setup(new Error("boom"));
    await appError(failed.reviews.review("o", "a1", "p1", "en", user, "deep"));
    expect(failed.credits.releases).toBe(1);
    expect(failed.credits.balanceLeft).toBe(10);
    expect(failed.credits.commits).toEqual([]);
  });
  it("rates only existing reviews", async () => {
    const s = setup();
    expect(await s.reviews.rate("o", "rev-1", 5)).toEqual({ ok: true });
    expect((await appError(s.reviews.rate("o", "x", 5))).status).toBe(404);
  });
});

describe("LiveCallService", () => {
  it("derives the match key from session, replayed analysis or map", () => {
    const input = { map: "de_inferno", recentRounds: [] };
    expect(liveMatchKey("s1", "x", input)).toBe("session:s1");
    expect(
      liveMatchKey(null, "0b8f2d1c-1111-2222-3333-444455556666", input),
    ).toBe("analysis:0b8f2d1c-1111-2222-3333-444455556666");
    expect(liveMatchKey(null, "not-an-id", input)).toBe("state:de_inferno");
    expect(liveMatchKey(null, undefined, { recentRounds: [] })).toBe(
      "state:unknown",
    );
  });
  it("validates the frame: 400 missing state, 404 foreign session, 409 during live play", async () => {
    const s = setup();
    expect((await appError(s.calls.call("o", {}, "en", user))).body).toEqual({
      error: "sessionId or state is required.",
    });
    expect(
      (await appError(s.calls.call("o", { sessionId: "s2" }, "en", user)))
        .status,
    ).toBe(404);
    expect(
      (
        await appError(
          s.calls.call("o", { state: { map: "BAD MAP" } }, "en", user),
        )
      ).status,
    ).toBe(400);
    expect(
      await appError(
        s.calls.call("o", { state: { phase: "live" } }, "en", user),
      ),
    ).toMatchObject({
      status: 409,
      body: { code: "ai_between_rounds_only" },
    });
  });
  it("uses the server's session state and stores the call", async () => {
    const s = setup();
    const result = await s.calls.call("o", { sessionId: "s1" }, "en", user);
    expect(result).toEqual({
      id: "call-1",
      call: { promptVersion: "live-1" },
      meta: { latencyMs: 5, attempts: 1 },
    });
    expect(s.coaching.calls[0]).toMatchObject({
      sessionId: "s1",
      round: 3,
      promptVersion: "live-1",
    });
  });
  it("releases the live quota when the model fails", async () => {
    const s = setup(new Error("network"));
    expect(
      await appError(
        s.calls.call("o", { state: { phase: "over" } }, "en", user),
      ),
    ).toMatchObject({
      status: 502,
      body: { code: "ai_failed" },
    });
    expect(s.live.released).toBe(1);
  });
});
