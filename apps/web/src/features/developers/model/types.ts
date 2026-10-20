/** Scopes of a personal API key (mirrors the API's api-keys DTO). */
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

export type ApiKey = {
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
export type CreatedApiKey = ApiKey & { key: string };
export type ApiKeyList = {
  keys: ApiKey[];
  maxActive: number;
  baseUrl: string;
  docsUrl: string;
};
export type NewApiKey = {
  name: string;
  scopes: ApiScope[];
  expiresInDays?: number;
};

export const WEBHOOK_EVENTS = [
  "demo.completed",
  "demo.failed",
  "review.completed",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];
export type Webhook = {
  id: string;
  url: string;
  events: WebhookEvent[];
  active: boolean;
  consecutiveFailures: number;
  disabledReason: string | null;
  createdAt: string;
};
export type CreatedWebhook = Webhook & { secret: string };
export type Delivery = {
  id: string;
  webhookId: string;
  event: string;
  status: "pending" | "delivered" | "failed";
  attempts: number;
  lastStatus: number | null;
  lastError: string | null;
  createdAt: string;
};
export type TestResult = {
  delivered: boolean;
  status: number | null;
  error: string | null;
};
