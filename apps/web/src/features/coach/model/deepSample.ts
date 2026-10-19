/** Static, obviously-generic Deep review used only behind the blurred "Unlock" teaser. */
import { normalizeDeep, type DeepReview } from "./deep";

export const DEEP_SAMPLE: DeepReview = normalizeDeep({
  utility: {
    efficiency: 58,
    perType: [
      { type: "flash", thrown: 9, effective: 4, enemiesFlashed: 6 },
      { type: "smoke", thrown: 7, effective: 5 },
      { type: "molotov", thrown: 4, effective: 2, damage: 61 },
      { type: "he", thrown: 3, effective: 1, damage: 38 },
    ],
    grenades: [
      { round: 2, type: "smoke", place: "Window", verdict: "good" },
      { round: 4, type: "flash", place: "Connector", verdict: "wasted" },
      { round: 7, type: "molotov", place: "Stairs", verdict: "good" },
    ],
  },
  crosshair: {
    medianOffset: 5.2,
    wellPreAimed: 41,
    duels: 34,
    pitch: "low",
    histogram: [
      { from: 0, to: 3, count: 14 },
      { from: 3, to: 6, count: 11 },
      { from: 6, to: 9, count: 6 },
      { from: 9, count: 3 },
    ],
  },
  positioning: {
    isolation: 46,
    crossfire: 22,
    dangerZones: [
      { place: "Connector", deaths: 4, rounds: [3, 8, 12, 17] },
      { place: "Palace", deaths: 3, rounds: [5, 14, 20] },
    ],
  },
})!;
