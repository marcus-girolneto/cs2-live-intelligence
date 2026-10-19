import type { Role } from "./me.js";

/** "review" is the legacy alias of "review_quick". */
export type AiPurpose =
  | "review"
  | "review_quick"
  | "review_deep"
  | "live"
  | "report";
/** GET /v1/admin/users item (plan added by the plans module). */
export type AdminUserDto = {
  id: string;
  steamId: string | null;
  personaName: string | null;
  avatarUrl: string | null;
  role: Role;
  createdAt: string;
  lastLoginAt: string | null;
  matches: number;
  reviews: number;
  plan?: {
    id: string;
    name: string;
    status: string;
    source: string;
    renewsAt?: string;
  };
};
/** GET /v1/admin/audit item. */
export type AuditEntryDto = {
  id: string;
  adminId: string | null;
  action: string;
  details: unknown;
  createdAt: string;
};
export type AiAssignmentDto = {
  providerId: string;
  model: string;
  updatedAt: string;
};
export type AssignmentMapDto = Partial<Record<AiPurpose, AiAssignmentDto>>;
/** Provider profile as admins see it (secrets never returned). */
export type ProviderViewDto = {
  id: string;
  name: string;
  provider: string;
  baseUrl: string | null;
  apiStyle: string | null;
  jsonMode: string | null;
  maxTokensParam: string | null;
  maxOutputTokens: number | null;
  timeoutMs: number | null;
  maxAttempts: number | null;
  temperature: number | null;
  extraBody: Record<string, unknown>;
  allowHttp: boolean;
  headerNames: string[];
  keyConfigured: boolean;
  keyLast4: string | null;
  assignedTo: AiPurpose[];
  createdAt: string;
  updatedAt: string;
};
/** GET /v1/admin/settings and PUT response. */
export type AppSettingsViewDto = {
  settings: {
    dailyLimit: number | null;
    maxInputBytes: number | null;
    sampleDemoEnabled: boolean;
  };
  updatedAt: string | null;
  effective: {
    dailyLimit: number | null;
    maxInputBytes: number | null;
    sampleDemoEnabled: boolean;
    sampleDemoConfigured: boolean;
    aiSource: Partial<Record<AiPurpose, "database" | "env">> & {
      review: "database" | "env";
      live: "database" | "env";
    };
  };
};
