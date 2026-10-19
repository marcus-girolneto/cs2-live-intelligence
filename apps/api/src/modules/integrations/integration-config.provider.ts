import { paymentMethodsFromEnv } from "../../infrastructure/billing/payment-gateway-factory.js";
import type { SecretCipher } from "../../infrastructure/secrets/aes-gcm-secret-cipher.js";
import {
  SECRETS,
  stripeSettingsSchema,
  type ConfigSource,
  type SecretKey,
  type StripeSettings,
} from "./integrations.dto.js";
import type {
  IntegrationsRepository,
  StoredIntegrationSettings,
} from "./integrations.repository.js";

type Env = Record<string, string | undefined>;
export type Currency = "BRL" | "USD";

/** A secret in effect: database row first, then the bootstrap environment variable. */
export interface ResolvedSecret {
  value: string | undefined;
  source: ConfigSource;
  last4: string | null;
  updatedAt: string | null;
  /** The database row exists but cannot be decrypted (the env fallback is NOT used then). */
  undecryptable: boolean;
}
/** Stripe settings in effect. `active` = enabled + secret key + webhook secret. */
export interface StripeConfig {
  secretKey: string | undefined;
  webhookSecret: string | undefined;
  publishableKey: string | null;
  enabled: boolean;
  active: boolean;
  paymentMethods: Record<Currency, string[]>;
}
export interface IntegrationSnapshot {
  at: number;
  secrets: Record<SecretKey, ResolvedSecret>;
  settings: Partial<Record<string, StoredIntegrationSettings>>;
  stripe: StripeConfig;
}

/**
 * Port read at call time by the adapters that talk to third parties (Steam client, payment
 * gateway factory). Admin changes apply without a restart: the service invalidates the cache.
 */
export interface IntegrationConfigProvider {
  steamWebApiKey(): Promise<string | undefined>;
  stripe(): Promise<StripeConfig>;
  snapshot(): Promise<IntegrationSnapshot>;
  invalidate(): void;
}

const last4 = (value: string): string => value.slice(-4);
type StoredState = {
  at: number;
  secrets: Map<string, ResolvedSecret>;
  settings: Partial<Record<string, StoredIntegrationSettings>>;
};

/**
 * Database-backed provider with the environment as bootstrap fallback. The decrypted snapshot
 * is cached in memory, dropped on every admin change and expires after a short TTL so other
 * instances pick changes up too.
 */
export class CachedIntegrationConfig implements IntegrationConfigProvider {
  private cached?: StoredState;
  private loading?: Promise<StoredState>;
  constructor(
    private readonly repository: IntegrationsRepository,
    private readonly cipher: SecretCipher,
    private readonly env: () => Env,
    private readonly ttlMs = 30_000,
    private readonly now: () => number = Date.now,
  ) {}

  invalidate(): void {
    this.cached = undefined;
    this.loading = undefined;
  }

  async steamWebApiKey(): Promise<string | undefined> {
    return (await this.snapshot()).secrets.steamWebApiKey.value;
  }

  async stripe(): Promise<StripeConfig> {
    return (await this.snapshot()).stripe;
  }

  /** Database rows (cached, decrypted) merged with the environment read now. */
  async snapshot(): Promise<IntegrationSnapshot> {
    const state = await this.stored();
    const env = this.env();
    const secrets = {} as Record<SecretKey, ResolvedSecret>;
    for (const key of Object.keys(SECRETS) as SecretKey[])
      secrets[key] =
        state.secrets.get(SECRETS[key].name) ??
        this.fromEnv(env[SECRETS[key].env]);
    return {
      at: state.at,
      secrets,
      settings: state.settings,
      stripe: this.stripeConfig(secrets, state.settings.stripe, env),
    };
  }

  private async stored(): Promise<StoredState> {
    if (this.cached && this.now() - this.cached.at < this.ttlMs)
      return this.cached;
    this.loading ??= this.read();
    const loading = this.loading;
    try {
      const state = await loading;
      if (this.loading === loading) this.cached = state;
      return state;
    } finally {
      if (this.loading === loading) this.loading = undefined;
    }
  }

  private async read(): Promise<StoredState> {
    const [rows, settingRows] = await Promise.all([
      this.repository.secrets(),
      this.repository.settings(),
    ]);
    return {
      at: this.now(),
      secrets: new Map(
        rows.map((r) => [
          r.name,
          this.decrypt(r.name, r.ciphertext, r.last4, r.updatedAt),
        ]),
      ),
      settings: Object.fromEntries(settingRows.map((r) => [r.name, r])),
    };
  }

  private decrypt(
    name: string,
    ciphertext: string,
    storedLast4: string | null,
    updatedAt: string,
  ): ResolvedSecret {
    try {
      const value = this.cipher.decrypt(ciphertext, secretContext(name));
      return {
        value,
        source: "database",
        last4: storedLast4 ?? last4(value),
        updatedAt,
        undecryptable: false,
      };
    } catch {
      return {
        value: undefined,
        source: "database",
        last4: storedLast4,
        updatedAt,
        undecryptable: true,
      };
    }
  }

  private fromEnv(raw: string | undefined): ResolvedSecret {
    const value = raw?.trim() || undefined;
    return {
      value,
      source: value ? "env" : "none",
      last4: value ? last4(value) : null,
      updatedAt: null,
      undecryptable: false,
    };
  }

  private stripeConfig(
    secrets: Record<SecretKey, ResolvedSecret>,
    row: StoredIntegrationSettings | undefined,
    env: Env,
  ): StripeConfig {
    const parsed = stripeSettingsSchema.safeParse(row?.settings ?? {});
    const stored: StripeSettings = parsed.success ? parsed.data : {};
    const secretKey = secrets.stripeSecretKey.value;
    const webhookSecret = secrets.stripeWebhookSecret.value;
    const enabled = stored.enabled ?? true;
    return {
      secretKey,
      webhookSecret,
      publishableKey:
        stored.publishableKey !== undefined
          ? stored.publishableKey
          : env.STRIPE_PUBLISHABLE_KEY?.trim() || null,
      enabled,
      active: enabled && !!secretKey && !!webhookSecret,
      paymentMethods: {
        BRL:
          stored.paymentMethods?.BRL ??
          paymentMethodsFromEnv(env.STRIPE_PAYMENT_METHODS_BRL),
        USD:
          stored.paymentMethods?.USD ??
          paymentMethodsFromEnv(env.STRIPE_PAYMENT_METHODS_USD),
      },
    };
  }
}

/** Associated data that binds a stored secret's ciphertext to its name. */
export const secretContext = (name: string): string => `app_secret:${name}`;
