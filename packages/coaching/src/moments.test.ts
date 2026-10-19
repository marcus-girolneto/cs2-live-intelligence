import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { analyzeDemo } from "@cs2/analytics";
import { coachingSchema } from "@cs2/contracts";
import {
  buildReview,
  contradictsOutcome,
  momentCandidates,
  momentKind,
  momentOutcome,
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

describe("key-moment outcome consistency", () => {
  it("states the outcome explicitly on every candidate", () => {
    const candidates = momentCandidates(enriched(), "a");
    expect(candidates.length).toBeGreaterThan(0);
    for (const c of candidates)
      expect(c.outcome).toBe(
        c.kind === "kill" ? "YOU KILLED an enemy" : "YOU DIED to an enemy",
      );
    expect(momentOutcome("kill")).toMatch(/^YOU KILLED/);
    expect(momentOutcome("death")).toMatch(/^YOU DIED/);
  });

  it("derives the card kind from the event", () => {
    expect(momentKind("kill")).toBe("highlight");
    expect(momentKind("death")).toBe("mistake");
  });

  it.each([
    ["Round 3: you die at Middle to the AWP.", "kill", true],
    ["You were killed holding A site.", "kill", true],
    ["Rodada 3: você morreu no Meio.", "kill", true],
    ["O AWP te matou no Meio.", "kill", true],
    ["You won the opening duel at Middle.", "kill", false],
    ["You killed the AWPer, then died to the trade.", "kill", false],
    ["Você matou o AWPer no Meio.", "kill", false],
    ["You killed the entry fragger at B.", "death", true],
    ["Você matou dois e segurou o bomb.", "death", true],
    ["You took the duel alone and died untraded.", "death", false],
    ["You died alone at Middle, untraded.", "death", false],
    ["Você foi morto sozinho no Meio.", "death", false],
    ["With 45 HP you peeked Middle.", "death", false],
  ] as const)("%s (%s) → contradicts=%s", (text, kind, expected) => {
    expect(contradictsOutcome(text, kind)).toBe(expected);
  });

  it("forces the kind from the event and drops contradicting moments", () => {
    const a = enriched();
    const candidates = momentCandidates(a, "a");
    const kill = candidates.find((c) => c.kind === "kill")!;
    const death = candidates.find((c) => c.kind === "death")!;
    const moment = (eventId: string, whatHappened: string, kind: string) => ({
      eventId,
      title: "Moment",
      whatHappened,
      whatToDoInstead: "Repeat it or fall back.",
      kind,
      scope: "general",
    });
    const review = coachingSchema.parse(
      buildReview(
        {
          insights: [],
          keyMoments: [
            // The model mislabels the player's kill as a mistake: kind is corrected.
            moment(kill.id, "You won the opening duel.", "mistake"),
            // The player's death described as a kill: dropped.
            moment(death.id, "You killed the entry fragger.", "mistake"),
          ],
        },
        a,
        {
          focusSteamId: "a",
          lang: "en",
          candidateIds: candidates,
          allowedFacts: new Set(a.evidence.map((e) => e.id)),
        },
      ),
    );
    expect(review.keyMoments).toHaveLength(1);
    expect(review.keyMoments![0]).toMatchObject({
      eventId: kill.id,
      kind: "highlight",
    });
  });

  it("drops the player's kill told as a death", () => {
    const a = enriched();
    const candidates = momentCandidates(a, "a");
    const kill = candidates.find((c) => c.kind === "kill")!;
    const review = buildReview(
      {
        insights: [],
        keyMoments: [
          {
            eventId: kill.id,
            title: "Caught at Middle",
            whatHappened: "You die to the AWP at Middle.",
            whatToDoInstead: "Use a flash.",
            kind: "mistake",
            scope: "map",
          },
        ],
      },
      a,
      {
        focusSteamId: "a",
        lang: "en",
        candidateIds: candidates,
        allowedFacts: new Set(),
      },
    );
    expect(review.keyMoments).toBeUndefined();
  });
});
