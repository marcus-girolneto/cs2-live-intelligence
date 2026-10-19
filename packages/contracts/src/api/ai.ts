/** Per-purpose AI status: admins get provider details, others only `configured`. */
export type AiPurposeStatusDto = {
  configured: boolean;
  source?: "database" | "env";
  providerId?: string;
  providerName?: string;
  reason?: string;
  missing?: string[];
  provider?: string;
  model?: string;
  endpoint?: string;
  apiStyle?: string;
  jsonMode?: string;
  dailyLimit?: number | null;
  keyConfigured?: boolean;
};
/** GET /v1/ai/status (top-level fields describe the review purpose). */
export type AiStatusDto = AiPurposeStatusDto & {
  purposes: { review: AiPurposeStatusDto; live: AiPurposeStatusDto };
};
/** Error bodies of AI endpoints (`code` is `ai_<reason>`). */
export type AiErrorDto = {
  error: string;
  code: string;
  providerStatus?: number;
  missing?: string[];
  purpose?: "review" | "live";
  source?: "database" | "env";
};
