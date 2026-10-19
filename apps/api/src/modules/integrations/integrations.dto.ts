import { z } from "zod";

/** Names of the encrypted secrets in `app_secrets` and their bootstrap environment variable. */
export const SECRETS = {
  steamWebApiKey: { name: "steam.webApiKey", env: "STEAM_WEB_API_KEY" },
  stripeSecretKey: { name: "stripe.secretKey", env: "STRIPE_SECRET_KEY" },
  stripeWebhookSecret: {
    name: "stripe.webhookSecret",
    env: "STRIPE_WEBHOOK_SECRET",
  },
} as const;
export type SecretKey = keyof typeof SECRETS;
export const INTEGRATION_NAMES = ["steam", "stripe"] as const;
export type IntegrationName = (typeof INTEGRATION_NAMES)[number];

/** Where a value in effect comes from: admin-managed database row, bootstrap env, or nowhere. */
export type ConfigSource = "database" | "env" | "none";

const token = (pattern: RegExp, hint: string) =>
  z.string().trim().min(8).max(256).regex(pattern, hint);
const steamKey = token(
  /^[A-Za-z0-9]{16,64}$/,
  "Steam Web API key (letters and digits)",
);
const stripeSecret = token(
  /^(sk|rk)_(test|live)_[A-Za-z0-9]+$/,
  "Stripe secret key (sk_live_/sk_test_/rk_…)",
);
const stripeWebhook = token(
  /^whsec_[A-Za-z0-9+/=]+$/,
  "Stripe webhook secret (whsec_…)",
);
const stripePublishable = token(
  /^pk_(test|live)_[A-Za-z0-9]+$/,
  "Stripe publishable key (pk_live_/pk_test_…)",
);
const methods = z
  .array(z.string().regex(/^[a-z_]{2,40}$/))
  .min(1)
  .max(10);

/** PUT /v1/admin/integrations/steam: a new key, or null to clear the stored one. */
export const steamUpdateSchema = z
  .object({ webApiKey: steamKey.nullable() })
  .strict();
export type SteamUpdateDto = z.infer<typeof steamUpdateSchema>;

/** PUT /v1/admin/integrations/stripe: omitted fields are kept, null clears. */
export const stripeUpdateSchema = z
  .object({
    secretKey: stripeSecret.nullable().optional(),
    webhookSecret: stripeWebhook.nullable().optional(),
    publishableKey: stripePublishable.nullable().optional(),
    enabled: z.boolean().optional(),
    paymentMethods: z
      .object({ BRL: methods.optional(), USD: methods.optional() })
      .strict()
      .nullable()
      .optional(),
  })
  .strict();
export type StripeUpdateDto = z.infer<typeof stripeUpdateSchema>;

/** Stored (non-secret) Stripe settings in `integration_settings`. */
export const stripeSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  publishableKey: z.string().nullable().optional(),
  paymentMethods: z
    .object({ BRL: methods.optional(), USD: methods.optional() })
    .optional(),
});
export type StripeSettings = z.infer<typeof stripeSettingsSchema>;

export const integrationNameSchema = z.enum(INTEGRATION_NAMES);

export type SteamIntegrationDto = {
  configured: boolean;
  source: ConfigSource;
  last4: string | null;
  updatedAt: string | null;
  /** A stored key exists but cannot be decrypted (APP_ENCRYPTION_KEY changed): re-enter it. */
  undecryptable?: true;
};
export type StripeIntegrationDto = {
  configured: boolean;
  source: ConfigSource;
  secretKeyLast4: string | null;
  webhookConfigured: boolean;
  webhookSource: ConfigSource;
  publishableKey: string | null;
  /** Admin switch (default true). Billing runs only when enabled AND configured. */
  enabled: boolean;
  /** Billing is live right now (enabled + secret key + webhook secret). */
  active: boolean;
  paymentMethods: { BRL: string[]; USD: string[] };
  updatedAt: string | null;
  /** Where Stripe must send webhook events (API_PUBLIC_URL + /v1/billing/webhook). */
  webhookUrl: string;
  undecryptable?: true;
};
export type IntegrationsViewDto = {
  steam: SteamIntegrationDto;
  stripe: StripeIntegrationDto;
  apiPublicUrl: string;
};
export type IntegrationTestDto = {
  ok: boolean;
  latencyMs: number;
  detail: string;
  livemode?: boolean;
};
