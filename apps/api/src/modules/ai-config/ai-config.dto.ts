import { z } from "zod";

export type AiPurpose = "review" | "live";
export const AI_PURPOSES: AiPurpose[] = ["review", "live"];

/** Stored per-provider options (mirrors the AI_* knobs of @cs2/coaching). */
export const providerOptionsSchema = z
  .object({
    apiStyle: z.enum(["chat", "responses"]).optional(),
    jsonMode: z.enum(["json_schema", "json_object", "prompt"]).optional(),
    maxTokensParam: z
      .string()
      .regex(/^[a-z][a-z0-9_]{0,63}$/)
      .optional(),
    maxOutputTokens: z.number().int().min(64).max(200_000).optional(),
    timeoutMs: z.number().int().min(1_000).max(600_000).optional(),
    maxAttempts: z.number().int().min(1).max(5).optional(),
    temperature: z.number().min(0).max(2).nullable().optional(),
    extraBody: z.record(z.unknown()).optional(),
    allowHttp: z.boolean().optional(),
  })
  .strict();
export type ProviderOptions = z.infer<typeof providerOptionsSchema>;
export const PROVIDER_OPTION_KEYS = Object.keys(providerOptionsSchema.shape);

/** Admin-tunable app settings (GET/PUT /v1/admin/settings). */
export const appSettingsSchema = z
  .object({
    // null = use the AI_DAILY_LIMIT environment default; 0 = unlimited.
    dailyLimit: z.number().int().min(0).max(1_000_000).nullable(),
    // null = use AI_MAX_INPUT_BYTES (default 200000).
    maxInputBytes: z.number().int().min(1_000).max(5_000_000).nullable(),
    sampleDemoEnabled: z.boolean(),
  })
  .strict();
export type AppSettings = z.infer<typeof appSettingsSchema>;
export const DEFAULT_APP_SETTINGS: AppSettings = {
  dailyLimit: null,
  maxInputBytes: null,
  sampleDemoEnabled: true,
};

const providerName = z.string().trim().min(1).max(64);
const providerLabel = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9._-]{0,31}$/, "lowercase letters, digits, . _ -");
const baseUrl = z.string().trim().url().max(512);
const apiKey = z.string().trim().min(1).max(1024);
const headers = z
  .record(
    z.string().regex(/^[A-Za-z0-9-]{1,64}$/),
    z
      .string()
      .max(2048)
      .regex(/^[^\r\n]*$/),
  )
  .refine((h) => Object.keys(h).length <= 20, "at most 20 headers");
const extraBody = z
  .record(z.unknown())
  .refine((b) => JSON.stringify(b).length <= 8192, "extraBody too large");
const options = providerOptionsSchema.extend({
  extraBody: extraBody.optional(),
});

/** POST /v1/admin/ai/providers. */
export const createProviderSchema = options
  .extend({
    name: providerName,
    provider: providerLabel,
    baseUrl: baseUrl.nullable().optional(),
    apiKey: apiKey.optional(),
    headers: headers.optional(),
  })
  .strict();
export type CreateProviderDto = z.infer<typeof createProviderSchema>;

/** PUT /v1/admin/ai/providers/:id — apiKey undefined keeps the stored key; null removes it. */
export const updateProviderSchema = options
  .extend({
    name: providerName.optional(),
    provider: providerLabel.optional(),
    baseUrl: baseUrl.nullable().optional(),
    apiKey: apiKey.nullable().optional(),
    headers: headers.nullable().optional(),
  })
  .strict();
export type UpdateProviderDto = z.infer<typeof updateProviderSchema>;

const modelName = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[^\s]+$/, "no whitespace");
const assignment = z
  .object({ providerId: z.string().uuid(), model: modelName })
  .strict();
/** PUT /v1/admin/ai/assignments — null unassigns a purpose. */
export const assignmentsSchema = z
  .object({
    review: assignment.nullable().optional(),
    live: assignment.nullable().optional(),
  })
  .strict();
export type AssignmentsDto = z.infer<typeof assignmentsSchema>;
/** POST /v1/admin/ai/providers/:id/test. */
export const providerTestSchema = z
  .object({ model: modelName.optional() })
  .strict()
  .nullable()
  .optional();

export type AiAssignment = {
  providerId: string;
  model: string;
  updatedAt: string;
};
export type AssignmentMap = Partial<Record<AiPurpose, AiAssignment>>;

/** Provider profile as shown to admins (secrets never leave the server). */
export type ProviderViewDto = {
  id: string;
  name: string;
  provider: string;
  baseUrl: string | null;
  apiStyle: unknown;
  jsonMode: unknown;
  maxTokensParam: unknown;
  maxOutputTokens: unknown;
  timeoutMs: unknown;
  maxAttempts: unknown;
  temperature: unknown;
  extraBody: unknown;
  allowHttp: boolean;
  headerNames: string[];
  keyConfigured: boolean;
  keyLast4: string | null;
  assignedTo: AiPurpose[];
  createdAt: string;
  updatedAt: string;
};
