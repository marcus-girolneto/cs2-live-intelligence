/** A v5-style coaching payload with scores, key moments, drills and per-map scope. */
export function mockCoaching() {
  return {
    schemaVersion: "1.0",
    mode: "provider",
    map: "de_mirage",
    verdict: "Sharp aim, lonely entries.",
    summary:
      "You win your first duel more often than anyone in the lobby, but you take it alone: 4 of your 6 deaths came with no teammate close enough to trade.",
    scores: {
      aim: { value: 78, label: "Aim", basis: "Headshot rate 52% vs lobby 38%" },
      positioning: {
        value: 41,
        label: "Positioning",
        basis: "4 untraded early deaths",
      },
      utility: {
        value: 55,
        label: "Utility",
        basis: "1.1 enemies flashed per round",
      },
      trading: {
        value: 36,
        label: "Trading",
        basis: "33% of your deaths traded",
      },
      economy: { value: 62, label: "Economy", basis: "2 force-buys lost" },
      impact: { value: 70, label: "Impact", basis: "ADR 92 vs lobby 76" },
    },
    keyMoments: [
      {
        eventId: "k-1",
        round: 3,
        time: 17.2,
        title: "Clean flash-peek headshot on A",
        whatHappened:
          "Your own flash blinded the CT and you took the headshot in 0.4 s.",
        whatToDoInstead: "Repeat this: self-flash, then peek the same angle.",
        kind: "highlight",
        scope: "map",
        clip: { round: 3, from: 10, to: 24, at: 17.2 },
      },
      {
        eventId: "k-2",
        round: 3,
        time: 21.4,
        title: "Dry swing into Connector",
        whatHappened:
          "After the kill you pushed alone at 54 HP and died to a crossfire.",
        whatToDoInstead:
          "Fall back to the site and wait for your trade partner.",
        kind: "mistake",
        scope: "map",
        clip: { round: 3, from: 16, to: 26, at: 21.4 },
      },
      {
        eventId: "k-3",
        round: 3,
        time: 24,
        title: "Teammate trades nobody",
        whatHappened:
          "You were 1,200 units from the closest teammate when you died.",
        whatToDoInstead: "Play within one flash of a teammate on entries.",
        kind: "mistake",
        scope: "general",
        clip: { round: 3, from: 18, to: 28, at: 21.4 },
      },
    ],
    insights: [
      {
        observation: "You open rounds with excellent first-bullet accuracy.",
        evidenceIds: ["e1"],
        confidence: "high",
        actionablePractice:
          "Keep the 10-minute pre-aim warm-up before matches.",
        caveats: [],
        kind: "strength",
        scope: "general",
        clips: [{ round: 3, from: 12, to: 22, at: 17.2 }],
      },
      {
        observation:
          "Your A-site entries on Mirage come without a trade partner.",
        evidenceIds: ["e2"],
        confidence: "medium",
        actionablePractice:
          "Enter A through Ramp only with a teammate on Palace.",
        caveats: ["Small sample: one match."],
        kind: "improve",
        scope: "map",
        clips: [{ round: 3, from: 16, to: 26, at: 21.4 }],
      },
      {
        observation:
          "You lose most rounds where you die in the first 20 seconds.",
        evidenceIds: ["e3"],
        confidence: "medium",
        actionablePractice: "Hold your first contact until utility lands.",
        caveats: [],
        kind: "improve",
        scope: "general",
        clips: [],
      },
    ],
    drills: [
      {
        name: "Flash-peek pairs",
        durationMinutes: 10,
        howTo: "In a 2v2 retake server, only peek after your partner's flash.",
        metric: "Deaths traded ≥ 50%",
        scope: "general",
      },
      {
        name: "Ramp → A timings",
        durationMinutes: 8,
        howTo: "Walk Ramp with a smoke for CT and Jungle, then swing together.",
        metric: "Opening duels won on A",
        scope: "map",
      },
      {
        name: "Crosshair at head height",
        durationMinutes: 5,
        howTo: "Prefire map, head height only.",
        scope: "general",
      },
    ],
    planItems: [
      {
        text: "Play every entry within one flash of a teammate.",
        scope: "general",
      },
      {
        text: "On Mirage A, wait for the Jungle smoke before Ramp.",
        scope: "map",
        map: "de_mirage",
      },
      { text: "Buy armor before utility on force rounds.", scope: "general" },
    ],
    plan: [
      "Play every entry within one flash of a teammate.",
      "On Mirage A, wait for the Jungle smoke before Ramp.",
      "Buy armor before utility on force rounds.",
    ],
    caveats: ["One match is a small sample."],
  };
}
