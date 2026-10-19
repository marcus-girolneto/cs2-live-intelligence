import type { IntegrationProbes } from "../../infrastructure/integrations/http-integration-probes.js";
import {
  SecretKeyUnavailable,
  type SecretCipher,
} from "../../infrastructure/secrets/aes-gcm-secret-cipher.js";
import { InternalError } from "../../shared/errors/index.js";
import type { AuditTrail } from "../../shared/ports/audit-trail.js";
import {
  secretContext,
  type IntegrationConfigProvider,
  type IntegrationSnapshot,
} from "./integration-config.provider.js";
import {
  SECRETS,
  stripeSettingsSchema,
  type IntegrationName,
  type IntegrationTestDto,
  type IntegrationsViewDto,
  type SecretKey,
  type SteamUpdateDto,
  type StripeSettings,
  type StripeUpdateDto,
} from "./integrations.dto.js";
import type { IntegrationsRepository } from "./integrations.repository.js";

/** Port (users): the admin's own SteamID64 for the Steam key test. */
export interface SteamIdLookup {
  steamId(ownerId: string): Promise<string | undefined>;
}

type Change = "set" | "cleared";
const latest = (...values: (string | null | undefined)[]): string | null =>
  values
    .filter((v): v is string => !!v)
    .sort()
    .at(-1) ?? null;

/**
 * Admin management of third-party integrations: encrypted secrets in `app_secrets`,
 * non-secret settings in `integration_settings`. Secrets are write-only (never returned or
 * audited); every change invalidates the config cache so it applies on the next call.
 */
export class IntegrationsService {
  constructor(
    private readonly repository: IntegrationsRepository,
    private readonly cipher: SecretCipher,
    private readonly config: IntegrationConfigProvider,
    private readonly audit: AuditTrail,
    private readonly probes: IntegrationProbes,
    private readonly users: SteamIdLookup,
    private readonly apiPublicUrl: string,
  ) {}

  async view(): Promise<IntegrationsViewDto> {
    this.config.invalidate();
    return this.render(await this.config.snapshot());
  }

  async updateSteam(
    adminId: string,
    body: SteamUpdateDto,
  ): Promise<IntegrationsViewDto> {
    const change = await this.writeSecret(
      adminId,
      "steamWebApiKey",
      body.webApiKey,
    );
    await this.audit.record(adminId, "integrations.steam.update", {
      webApiKey: change,
    });
    return this.view();
  }

  async updateStripe(
    adminId: string,
    body: StripeUpdateDto,
  ): Promise<IntegrationsViewDto> {
    const changes: Record<string, unknown> = {};
    if (body.secretKey !== undefined)
      changes.secretKey = await this.writeSecret(
        adminId,
        "stripeSecretKey",
        body.secretKey,
      );
    if (body.webhookSecret !== undefined)
      changes.webhookSecret = await this.writeSecret(
        adminId,
        "stripeWebhookSecret",
        body.webhookSecret,
      );
    const settingsPatch = this.stripeSettingsPatch(body);
    if (Object.keys(settingsPatch).length) {
      const snapshot = await this.config.snapshot();
      const stored = stripeSettingsSchema.safeParse(
        snapshot.settings.stripe?.settings ?? {},
      );
      const next: StripeSettings = {
        ...(stored.success ? stored.data : {}),
        ...settingsPatch,
      };
      if (body.paymentMethods === null) delete next.paymentMethods;
      await this.repository.saveSettings("stripe", next, adminId);
      Object.assign(changes, this.describeSettings(body));
    }
    this.config.invalidate();
    await this.audit.record(adminId, "integrations.stripe.update", changes);
    return this.view();
  }

  /** Live check of the credential in effect (database or env). */
  async test(
    adminId: string,
    name: IntegrationName,
  ): Promise<IntegrationTestDto> {
    const snapshot = await this.config.snapshot();
    const result =
      name === "steam"
        ? await this.testSteam(adminId, snapshot)
        : await this.testStripe(snapshot);
    await this.audit.record(adminId, "integrations.test", {
      name,
      ok: result.ok,
    });
    return result;
  }

  private async testSteam(
    adminId: string,
    snapshot: IntegrationSnapshot,
  ): Promise<IntegrationTestDto> {
    const key = snapshot.secrets.steamWebApiKey.value;
    if (!key)
      return { ok: false, latencyMs: 0, detail: "No Steam Web API key." };
    const steamId = await this.users.steamId(adminId);
    if (!steamId)
      return {
        ok: false,
        latencyMs: 0,
        detail: "Your account has no SteamID; sign in with Steam to test.",
      };
    return this.probes.steam(key, steamId);
  }

  private async testStripe(
    snapshot: IntegrationSnapshot,
  ): Promise<IntegrationTestDto> {
    const key = snapshot.stripe.secretKey;
    if (!key)
      return { ok: false, latencyMs: 0, detail: "No Stripe secret key." };
    return this.probes.stripe(key);
  }

  private stripeSettingsPatch(body: StripeUpdateDto): StripeSettings {
    const patch: StripeSettings = {};
    if (body.enabled !== undefined) patch.enabled = body.enabled;
    if (body.publishableKey !== undefined)
      patch.publishableKey = body.publishableKey;
    if (body.paymentMethods) patch.paymentMethods = body.paymentMethods;
    if (body.paymentMethods === null) patch.paymentMethods = undefined;
    return patch;
  }

  /** Audit details for non-secret Stripe settings (values are not sensitive). */
  private describeSettings(body: StripeUpdateDto): Record<string, unknown> {
    return {
      ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
      ...(body.publishableKey !== undefined
        ? { publishableKey: body.publishableKey === null ? "cleared" : "set" }
        : {}),
      ...(body.paymentMethods !== undefined
        ? { paymentMethods: body.paymentMethods ?? "default" }
        : {}),
    };
  }

  private async writeSecret(
    adminId: string,
    key: SecretKey,
    value: string | null,
  ): Promise<Change> {
    const { name } = SECRETS[key];
    if (value === null) {
      await this.repository.deleteSecret(name);
      this.config.invalidate();
      return "cleared";
    }
    let ciphertext: string;
    try {
      ciphertext = this.cipher.encrypt(value, secretContext(name));
    } catch (error) {
      if (error instanceof SecretKeyUnavailable)
        throw new InternalError(error.message);
      throw error;
    }
    await this.repository.saveSecret(
      name,
      ciphertext,
      value.slice(-4),
      adminId,
    );
    this.config.invalidate();
    return "set";
  }

  private render(s: IntegrationSnapshot): IntegrationsViewDto {
    const steam = s.secrets.steamWebApiKey;
    const secret = s.secrets.stripeSecretKey;
    const webhook = s.secrets.stripeWebhookSecret;
    return {
      steam: {
        configured: !!steam.value,
        source: steam.source,
        last4: steam.last4,
        updatedAt: steam.updatedAt,
        ...(steam.undecryptable ? { undecryptable: true as const } : {}),
      },
      stripe: {
        configured: !!secret.value,
        source: secret.source,
        secretKeyLast4: secret.last4,
        webhookConfigured: !!webhook.value,
        webhookSource: webhook.source,
        publishableKey: s.stripe.publishableKey,
        enabled: s.stripe.enabled,
        active: s.stripe.active,
        paymentMethods: s.stripe.paymentMethods,
        updatedAt: latest(
          secret.updatedAt,
          webhook.updatedAt,
          s.settings.stripe?.updatedAt,
        ),
        webhookUrl: `${this.apiPublicUrl}/v1/billing/webhook`,
        ...(secret.undecryptable || webhook.undecryptable
          ? { undecryptable: true as const }
          : {}),
      },
      apiPublicUrl: this.apiPublicUrl,
    };
  }
}
