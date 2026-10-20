import { isApiError } from "@/shared/http";

export type Purpose =
  | "review_quick"
  | "review_deep"
  | "review_team"
  | "verify"
  | "live"
  | "report"
  | "personal_coach";
export const PURPOSES: Purpose[] = [
  "review_quick",
  "review_deep",
  "review_team",
  "verify",
  "live",
  "report",
  "personal_coach",
];
/** A purpose without its own assignment uses this one (then the .env default). */
export const PURPOSE_FALLBACK: Partial<Record<Purpose, Purpose>> = {
  review_deep: "review_quick",
  review_team: "review_deep",
  verify: "review_quick",
  report: "review_quick",
  personal_coach: "review_deep",
};
/** Labels of every purpose, including the legacy single "review" purpose. */
export const PURPOSE_LABEL: Record<string, string> = {
  review: "Post-match review",
  review_quick: "Quick review",
  review_deep: "Deep review",
  review_team: "Team review",
  verify: "Claim verifier",
  live: "Live IGL",
  report: "Monthly report",
  personal_coach: "Personal Coach",
};
export const PURPOSE_HINT: Record<Purpose, string> = {
  review_quick: "Quick review after each demo. A fast, reliable model.",
  review_deep:
    "Deep review (utility, crosshair, positioning, rounds). Prefer your strongest model.",
  review_team:
    "Team review: the IGL view of a whole team. A strong model with a large context.",
  verify:
    "Double-checks every claim of a review against the match facts. A fast, cheap model is enough.",
  live: "Short IGL calls between rounds. Prefer a fast model.",
  report:
    "Monthly performance report for Pro players. A strong model with a large context.",
  personal_coach:
    "Personal Coach plans from all of a player's matches (Pro). Your strongest long-context model.",
};
/** Legacy APIs answer with a single "review" purpose: it stands in for Quick. */
export const legacyPurpose = (p: Purpose) =>
  p === "review_quick" ? "review" : null;

export type Provider = {
  id: string;
  name: string;
  provider: string;
  baseUrl: string | null;
  apiStyle?: "chat" | "responses" | null;
  jsonMode?: "json_schema" | "json_object" | "prompt" | null;
  maxTokensParam?: string | null;
  maxOutputTokens?: number | null;
  timeoutMs?: number | null;
  maxAttempts?: number | null;
  temperature?: number | null;
  extraBody?: Record<string, unknown> | null;
  allowHttp?: boolean;
  headerNames?: string[];
  keyConfigured?: boolean;
  keyLast4?: string | null;
  assignedTo?: string[];
  createdAt?: string;
  updatedAt?: string;
};
export type Assignment = {
  providerId: string;
  model: string;
  updatedAt?: string;
};
export type Assignments = Partial<Record<Purpose | "review", Assignment>>;
export type ProvidersResponse = {
  providers?: Provider[];
  assignments?: Assignments;
};

export type PurposeStatus =
  | {
      configured: false;
      source?: "database" | "env";
      providerId?: string;
      providerName?: string;
      reason?: string;
      missing?: string[];
    }
  | {
      configured: true;
      source?: "database" | "env";
      providerId?: string;
      providerName?: string;
      provider: string;
      model: string;
      endpoint?: string;
      apiStyle?: string;
      jsonMode?: string;
      dailyLimit?: number | null;
      keyConfigured?: boolean;
    };
export type AiStatus = PurposeStatus & {
  purposes?: Partial<Record<Purpose | "review", PurposeStatus>>;
};
export type TestResult = {
  ok?: boolean;
  model?: string;
  provider?: string;
  latencyMs?: number;
  reply?: string;
};

export const errorText = (e: unknown, fallback: string) =>
  e instanceof Error && e.message ? e.message : fallback;
export const isForbidden = (e: unknown) => isApiError(e, 403);

export type AppSettings = {
  settings?: {
    dailyLimit: number | null;
    maxInputBytes: number | null;
    sampleDemoEnabled: boolean;
    timezone?: string;
    personalCoachIntervalDays?: number;
    personalCoachNewMatches?: number;
    maxDemoBytes?: number;
  };
  updatedAt?: string | null;
  effective?: {
    dailyLimit?: number | null;
    maxInputBytes?: number | null;
    sampleDemoEnabled?: boolean;
    sampleDemoConfigured?: boolean;
    aiSource?: Partial<Record<Purpose | "review", string>>;
  };
};
export type AdminUser = {
  id: string;
  steamId?: string | null;
  personaName?: string | null;
  avatarUrl?: string | null;
  role?: "user" | "admin";
  createdAt?: string;
  lastLoginAt?: string | null;
  matches?: number;
  reviews?: number;
  plan?: unknown;
  /** Credit balance (when the API reports it). */
  credits?: number | null;
};
export type AuditEntry = {
  id: string;
  adminId?: string | null;
  action?: string;
  details?: unknown;
  createdAt?: string;
};
