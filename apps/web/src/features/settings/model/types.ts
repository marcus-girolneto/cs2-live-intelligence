export type CoachPreferences = {
  style: "aggressive" | "balanced" | "passive";
  tone: "direct" | "encouraging" | "analytical";
  detail: "brief" | "standard" | "deep";
  role: "auto" | "entry" | "support" | "awper" | "lurker" | "anchor" | "igl";
  focusAreas: string[];
  instructions: string;
};
export type AutoReview = { enabled: boolean; tier: "quick" | "deep" };
export type CoachProfile = {
  preferences: CoachPreferences;
  playerSteamId: string | null;
  linkedToSteam: boolean;
  /** Review new demos automatically (absent on older APIs). */
  autoReview?: AutoReview;
};
export type Device = {
  deviceId: string;
  name: string;
  createdAt: string;
  revokedAt: string | null;
};
export type Pairing = { code: string; expiresAt: string };
