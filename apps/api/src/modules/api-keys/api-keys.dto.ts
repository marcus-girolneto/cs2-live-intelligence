import { z } from "zod";

/**
 * What a personal API key may do. Every /api/v1 operation names the one scope it needs; a key
 * without it gets 403 `insufficient_scope`.
 */
export const API_SCOPES = [
  "matches:read",
  "matches:write",
  "analyses:read",
  "reviews:write",
  "progress:read",
  "account:read",
  "webhooks:manage",
] as const;
export type ApiScope = (typeof API_SCOPES)[number];

export const SCOPE_DESCRIPTIONS: Record<ApiScope, string> = {
  "matches:read": "List demos and read their status and summary.",
  "matches:write": "Upload and delete demos.",
  "analyses:read": "Read full analyses, player metrics and saved AI reviews.",
  "reviews:write": "Request AI reviews (spends credits).",
  "progress:read": "Read progress across your own matches.",
  "account:read": "Read the account, plan, credit balance and ledger.",
  "webhooks:manage": "Create, list, test and delete webhooks.",
};

/** Active (not revoked, not expired) keys per account. */
export const MAX_ACTIVE_KEYS = 10;

/** POST /v1/me/api-keys. */
export const createKeySchema = z
  .object({
    name: z.string().trim().min(1).max(64),
    scopes: z
      .array(z.enum(API_SCOPES))
      .min(1)
      .max(API_SCOPES.length)
      .transform((scopes) => [...new Set(scopes)]),
    /** Optional expiry: 1 to 365 days from now. */
    expiresInDays: z.number().int().min(1).max(365).optional(),
  })
  .strict();
export type CreateKeyRequest = z.infer<typeof createKeySchema>;

/** A key as listed (never the secret). */
export type ApiKeyDto = {
  id: string;
  name: string;
  prefix: string;
  scopes: ApiScope[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  status: "active" | "expired" | "revoked";
};
/** POST /v1/me/api-keys response: the only time the full key is returned. */
export type CreatedKeyDto = ApiKeyDto & { key: string };
export type ApiKeyListDto = {
  keys: ApiKeyDto[];
  maxActive: number;
  scopes: { id: ApiScope; description: string }[];
  /** Base URL of the public API and its interactive documentation. */
  baseUrl: string;
  docsUrl: string;
};

/** An authenticated API key (decorates the request on /api/v1). */
export type ApiKeyPrincipal = {
  keyId: string;
  ownerId: string;
  scopes: ApiScope[];
};
