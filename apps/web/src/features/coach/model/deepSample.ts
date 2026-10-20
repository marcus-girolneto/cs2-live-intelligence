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
    preAim: { onTarget: 9, close: 14, off: 11, total: 34 },
    heightBand: "chest",
    horizontalBias: "centered",
    perCallout: [{ callout: "Connector", onTarget: 1, total: 5 }],
    dots: [
      { x: 0.2, y: -1.1, won: true, category: "on" },
      { x: -0.9, y: -1.6, won: false, category: "close" },
      { x: 1.8, y: -0.8, won: false, category: "off" },
      { x: 0.4, y: -0.2, won: true, category: "on" },
      { x: -2.3, y: -2.1, won: false, category: "off" },
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
