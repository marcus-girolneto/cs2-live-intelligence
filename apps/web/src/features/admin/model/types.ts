import { isApiError } from "@/shared/http";

export type Purpose = "review" | "live";
export const PURPOSES: Purpose[] = ["review", "live"];
export const PURPOSE_LABEL: Record<Purpose, string> = {
  review: "Post-match review",
  live: "Live IGL",
};

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
  assignedTo?: Purpose[];
  createdAt?: string;
  updatedAt?: string;
};
export type Assignment = {
  providerId: string;
  model: string;
  updatedAt?: string;
};
export type Assignments = Partial<Record<Purpose, Assignment>>;
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
  purposes?: Partial<Record<Purpose, PurposeStatus>>;
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
  };
  updatedAt?: string | null;
  effective?: {
    dailyLimit?: number | null;
    maxInputBytes?: number | null;
    sampleDemoEnabled?: boolean;
    sampleDemoConfigured?: boolean;
    aiSource?: Partial<Record<Purpose, string>>;
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
};
export type AuditEntry = {
  id: string;
  adminId?: string | null;
  action?: string;
  details?: unknown;
  createdAt?: string;
};
