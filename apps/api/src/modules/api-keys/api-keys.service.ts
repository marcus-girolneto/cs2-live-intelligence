import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "../../shared/errors/index.js";
import type { Clock } from "../../shared/clock/clock.js";
import {
  keyPrefix,
  looksLikeApiKey,
  newApiKey,
  type ApiKeyHasher,
} from "./api-key.codec.js";
import {
  API_SCOPES,
  MAX_ACTIVE_KEYS,
  SCOPE_DESCRIPTIONS,
  type ApiKeyListDto,
  type ApiKeyPrincipal,
  type ApiScope,
  type CreateKeyRequest,
  type CreatedKeyDto,
} from "./api-keys.dto.js";
import type { ApiKeysRepository } from "./api-keys.repository.js";

/** Port: keyed hash of the caller's network (no raw addresses are stored). */
export interface NetworkHasher {
  network(ip: string): string | null;
}

const invalidKey = (code: string, message: string): UnauthorizedError =>
  new UnauthorizedError(message, { code });

/**
 * Personal API keys: create (shown once), list, revoke, and authenticate a Bearer key on
 * /api/v1 with scope checks. Denied uses of a real key are written to the key audit trail.
 */
export class ApiKeysService {
  constructor(
    private readonly keys: ApiKeysRepository,
    private readonly hasher: ApiKeyHasher,
    private readonly clock: Pick<Clock, "now">,
    private readonly networks: NetworkHasher,
    private readonly urls: { baseUrl: string; docsUrl: string },
  ) {}

  async list(ownerId: string): Promise<ApiKeyListDto> {
    return {
      keys: await this.keys.list(ownerId),
      maxActive: MAX_ACTIVE_KEYS,
      scopes: API_SCOPES.map((id) => ({
        id,
        description: SCOPE_DESCRIPTIONS[id],
      })),
      ...this.urls,
    };
  }

  async create(
    ownerId: string,
    request: CreateKeyRequest,
  ): Promise<CreatedKeyDto> {
    const key = newApiKey();
    const expiresAt = request.expiresInDays
      ? new Date(
          this.clock.now().getTime() + request.expiresInDays * 86_400_000,
        ).toISOString()
      : null;
    const created = await this.keys.create(
      {
        ownerId,
        name: request.name,
        prefix: keyPrefix(key),
        keyHash: this.hasher.hash(key),
        scopes: request.scopes,
        expiresAt,
      },
      MAX_ACTIVE_KEYS,
    );
    if (!created)
      throw new ConflictError(
        `You already have ${MAX_ACTIVE_KEYS} active API keys. Revoke one first.`,
        { code: "api_key_limit" },
      );
    await this.keys.event(ownerId, created.id, "key.created", {
      scopes: created.scopes,
      expiresAt,
    });
    return { ...created, key };
  }

  async revoke(ownerId: string, id: string): Promise<{ revoked: true }> {
    if (!(await this.keys.revoke(ownerId, id)))
      throw new NotFoundError("API key not found", { code: "not_found" });
    await this.keys.event(ownerId, id, "key.revoked");
    return { revoked: true };
  }

  /** Resolves `Authorization: Bearer fm_live_…`; throws 401 with a precise code otherwise. */
  async authenticate(
    token: string,
    ip: string | undefined,
  ): Promise<ApiKeyPrincipal> {
    if (!token)
      throw invalidKey(
        "missing_api_key",
        "Send your API key as Authorization: Bearer fm_live_...",
      );
    if (!looksLikeApiKey(token))
      throw invalidKey("invalid_api_key", "Invalid API key");
    const stored = await this.keys.findByHash(this.hasher.hash(token));
    if (!stored) throw invalidKey("invalid_api_key", "Invalid API key");
    if (stored.revoked || stored.expired) {
      const code = stored.revoked ? "api_key_revoked" : "api_key_expired";
      await this.keys.event(stored.ownerId, stored.id, "key.denied", {
        reason: code,
      });
      throw invalidKey(
        code,
        stored.revoked
          ? "This API key was revoked"
          : "This API key has expired",
      );
    }
    await this.keys.touch(stored.id, ip ? this.networks.network(ip) : null);
    return { keyId: stored.id, ownerId: stored.ownerId, scopes: stored.scopes };
  }

  /** 403 `insufficient_scope` (audited) unless the key holds `scope`. */
  async authorize(principal: ApiKeyPrincipal, scope: ApiScope): Promise<void> {
    if (principal.scopes.includes(scope)) return;
    await this.keys.event(principal.ownerId, principal.keyId, "key.denied", {
      reason: "insufficient_scope",
      scope,
    });
    throw new ForbiddenError(`This API key lacks the ${scope} scope`, {
      code: "insufficient_scope",
      details: { requiredScope: scope },
    });
  }
}
