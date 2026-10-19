export const STYLES = [
  [
    "aggressive",
    "Aggressive",
    "Proactive calls: take space, entry with a trade partner, pressure after picks.",
  ],
  [
    "balanced",
    "Balanced",
    "Aggression or discipline depending on what your data shows.",
  ],
  [
    "passive",
    "Passive",
    "Discipline: information, holding angles, trades, retakes, lower-risk duels.",
  ],
] as const;
export const TONES = [
  ["direct", "Direct"],
  ["encouraging", "Encouraging"],
  ["analytical", "Analytical"],
] as const;
export const DETAIL = [
  ["brief", "Brief"],
  ["standard", "Standard"],
  ["deep", "Deep"],
] as const;
export const ROLES = [
  ["auto", "Detect from my matches"],
  ["entry", "Entry fragger"],
  ["support", "Support"],
  ["awper", "AWPer"],
  ["lurker", "Lurker"],
  ["anchor", "Anchor"],
  ["igl", "IGL"],
] as const;
export const FOCUS = [
  ["aim", "Aim"],
  ["utility", "Utility"],
  ["positioning", "Positioning"],
  ["teamplay", "Teamplay & trades"],
  ["clutch", "Clutches"],
  ["economy", "Economy"],
  ["mindset", "Mindset"],
] as const;

/** Coach personality and identity. Saved to the account and used in every AI request. */
