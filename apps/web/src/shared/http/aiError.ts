import { ApiError } from "./ApiError";

/** What the failed AI request was writing (picks the friendly sentence). */
export type AiTask = "review" | "team" | "personal" | "report" | "live";

const UNFINISHED: Record<AiTask, string> = {
  review: "The coach couldn't finish your review. Try again in a moment.",
  team: "The coach couldn't finish your team review. Try again in a moment.",
  personal: "The coach couldn't finish your plan. Try again in a moment.",
  report: "The coach couldn't finish your report. Try again in a moment.",
  live: "The coach couldn't make a call this time. Try again in a moment.",
};
const BY_CODE: Record<string, string> = {
  ai_timeout: "The AI coach took too long to answer. Try again in a moment.",
  ai_between_rounds_only: "The live coach only speaks between rounds.",
  ai_input_too_large: "This match is too large for the AI coach.",
  ai_not_configured: "The AI coach is not available right now.",
  ai_limit: "The AI coach reached today's limit. Try again tomorrow.",
};
/**
 * The sentence shown when an AI request fails (English source; translate with t()). Model,
 * provider and configuration details never reach the page: they stay in the server logs and
 * the admin AI settings. Non-AI errors keep the server's message (already user-facing).
 */
export function aiErrorText(e: unknown, task: AiTask): string {
  const code = e instanceof ApiError ? (e.code ?? "") : "";
  if (BY_CODE[code]) return BY_CODE[code]!;
  if (code.startsWith("ai_")) return UNFINISHED[task];
  if (e instanceof ApiError && e.status >= 500) return UNFINISHED[task];
  return e instanceof Error && e.message ? e.message : UNFINISHED[task];
}
