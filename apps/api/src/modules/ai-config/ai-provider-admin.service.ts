import { randomUUID } from "node:crypto";
import type { AiConfigResult } from "@cs2/coaching";
import type {
  AiGateway,
  ConnectivityResult,
} from "../../infrastructure/ai/coaching-ai-gateway.js";
import type {
  ModelCatalog,
  ModelListing,
} from "../../infrastructure/ai/model-catalog.js";
import type { SecretCipher } from "../../infrastructure/secrets/aes-gcm-secret-cipher.js";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../shared/errors/index.js";
import type { AuditTrail } from "../../shared/ports/audit-trail.js";
import {
  AI_PURPOSES,
  PROVIDER_OPTION_KEYS,
  type AssignmentMap,
  type AssignmentsDto,
  type CreateProviderDto,
  type ProviderViewDto,
  type UpdateProviderDto,
} from "./ai-config.dto.js";
import type { AiConfigFactory, PlainProvider } from "./ai-config.factory.js";
import { providerView } from "./ai-config.mapper.js";
import type {
  AiConfigRepository,
  AiProviderRecord,
} from "./ai-config.repository.js";
import { providerTestError, secretFailure } from "./ai-errors.js";
import type { AiSettingsService } from "./ai-settings.service.js";
import { nextProviderRecord } from "./provider-update.js";

const last4 = (key: string): string | null =>
  key.length >= 12 ? key.slice(-4) : null;

function invalid(result: AiConfigResult): ValidationError | undefined {
  return result.ok
    ? undefined
    : new ValidationError(result.reason, {
        details: { missing: result.missing },
      });
}

/** Admin management of AI provider profiles and purpose assignments. */
export class AiProviderAdminService {
  constructor(
    private readonly repository: AiConfigRepository,
    private readonly settings: AiSettingsService,
    private readonly factory: AiConfigFactory,
    private readonly cipher: SecretCipher,
    private readonly gateway: AiGateway,
    private readonly catalog: ModelCatalog,
    private readonly audit: AuditTrail,
  ) {}

  async list(): Promise<{
    providers: ProviderViewDto[];
    assignments: AssignmentMap;
  }> {
    const { rows, assigned } = await this.snapshot();
    return {
      providers: rows.map((r) => providerView(r, assigned)),
      assignments: assigned,
    };
  }

  async create(
    adminId: string,
    body: CreateProviderDto,
  ): Promise<ProviderViewDto> {
    const options = Object.fromEntries(
      Object.entries(body).filter(
        ([k, v]) => PROVIDER_OPTION_KEYS.includes(k) && v !== undefined,
      ),
    );
    const headersJson =
      body.headers && Object.keys(body.headers).length
        ? JSON.stringify(body.headers)
        : undefined;
    const plain: PlainProvider = {
      provider: body.provider,
      baseUrl: body.baseUrl ?? null,
      apiKey: body.apiKey,
      headersJson,
      options,
    };
    const error = invalid(
      this.factory.validate(plain, await this.settings.settings()),
    );
    if (error) throw error;
    const id = randomUUID();
    try {
      await this.repository.saveProvider({
        id,
        name: body.name,
        provider: body.provider,
        baseUrl: body.baseUrl ?? null,
        apiKeyEnc: body.apiKey
          ? this.cipher.encrypt(body.apiKey, `ai_provider:${id}:apiKey`)
          : null,
        keyLast4: body.apiKey ? last4(body.apiKey) : null,
        headersEnc: headersJson
          ? this.cipher.encrypt(headersJson, `ai_provider:${id}:headers`)
          : null,
        headerNames: Object.keys(body.headers ?? {}),
        options,
      });
    } catch (failure) {
      secretFailure(failure);
    }
    await this.changed(adminId, "ai.provider.create", {
      providerId: id,
      name: body.name,
      provider: body.provider,
      baseUrl: body.baseUrl ?? null,
      keyConfigured: !!body.apiKey,
      headerNames: Object.keys(body.headers ?? {}),
    });
    return this.view(id);
  }

  async update(
    adminId: string,
    id: string,
    body: UpdateProviderDto,
  ): Promise<ProviderViewDto> {
    const row = await this.find(id);
    const next = nextProviderRecord(
      row,
      body,
      this.factory,
      this.cipher,
      last4,
    );
    const error = invalid(
      this.factory.validate(next.plain, await this.settings.settings()),
    );
    if (error) throw error;
    try {
      await this.repository.saveProvider(next.record());
    } catch (failure) {
      secretFailure(failure);
    }
    await this.changed(adminId, "ai.provider.update", {
      providerId: row.id,
      fields: Object.keys(body).filter(
        (k) => k !== "apiKey" && k !== "headers",
      ),
      keyChanged: body.apiKey !== undefined,
      headersChanged: body.headers !== undefined,
    });
    return this.view(row.id);
  }

  async remove(adminId: string, id: string): Promise<void> {
    const result = await this.repository.deleteProvider(id);
    if (result === "not_found") throw new NotFoundError("Provider not found");
    if (result === "in_use")
      throw new ConflictError(
        "The provider is assigned to review or live; reassign it first.",
      );
    await this.changed(adminId, "ai.provider.delete", { providerId: id });
  }

  async assignments(): Promise<{ assignments: AssignmentMap }> {
    return { assignments: await this.repository.assignments() };
  }

  async assign(
    adminId: string,
    changes: AssignmentsDto,
  ): Promise<{ assignments: AssignmentMap }> {
    const { rows } = await this.snapshot();
    const settings = await this.settings.settings();
    for (const purpose of AI_PURPOSES) {
      const value = changes[purpose];
      if (!value) continue;
      const row = rows.find((r) => r.id === value.providerId);
      if (!row) throw new ValidationError(`Unknown provider for ${purpose}`);
      const result = this.factory.fromProvider(row, value.model, settings);
      if (!result.ok)
        throw new ValidationError(`${purpose}: ${result.reason}`, {
          details: { missing: result.missing },
        });
    }
    await this.repository.setAssignments(changes);
    await this.changed(adminId, "ai.assignments.update", changes);
    return { assignments: await this.repository.assignments() };
  }

  async test(
    adminId: string,
    id: string,
    requestedModel?: string,
  ): Promise<ConnectivityResult> {
    const { rows, assigned } = await this.snapshot();
    const row = rows.find((r) => r.id === id);
    if (!row) throw new NotFoundError("Provider not found");
    const model =
      requestedModel ??
      AI_PURPOSES.map((p) => assigned[p]).find((a) => a?.providerId === row.id)
        ?.model;
    if (!model)
      throw new ValidationError(
        "Pass a model: this provider is not assigned to any purpose.",
      );
    const config = this.factory.fromProvider(
      row,
      model,
      await this.settings.settings(),
    );
    if (!config.ok) throw invalid(config)!;
    await this.audit.record(adminId, "ai.provider.test", {
      providerId: row.id,
      model,
    });
    try {
      return await this.gateway.connectivityCheck(config.config);
    } catch (error) {
      throw providerTestError(error);
    }
  }

  async models(id: string): Promise<ModelListing> {
    const row = await this.find(id);
    const loaded = this.factory.fromProvider(
      row,
      "model-listing",
      await this.settings.settings(),
    );
    if (!loaded.ok) throw invalid(loaded)!;
    return this.catalog.list(loaded.config);
  }

  private async snapshot(): Promise<{
    rows: AiProviderRecord[];
    assigned: AssignmentMap;
  }> {
    const [rows, assigned] = await Promise.all([
      this.repository.providers(),
      this.repository.assignments(),
    ]);
    return { rows, assigned };
  }

  private async find(id: string): Promise<AiProviderRecord> {
    const row = (await this.repository.providers()).find((r) => r.id === id);
    if (!row) throw new NotFoundError("Provider not found");
    return row;
  }

  private async view(id: string): Promise<ProviderViewDto> {
    const { rows, assigned } = await this.snapshot();
    return providerView(
      rows.find((r) => r.id === id)!,
      assigned,
    );
  }

  /** Every admin change invalidates the cached AI snapshot and is audited. */
  private async changed(
    adminId: string,
    action: string,
    details: unknown,
  ): Promise<void> {
    this.settings.invalidate();
    await this.audit.record(adminId, action, details);
  }
}
