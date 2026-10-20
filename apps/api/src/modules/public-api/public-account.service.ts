import type { MeDto } from "../users/users.dto.js";

/** Ports wired in the composition root (users, credits, progress). */
export type AccountSources = {
  me(ownerId: string): Promise<MeDto>;
  ledger(ownerId: string, limit: number): Promise<{ entries: unknown[] }>;
  progress(ownerId: string, map?: string): Promise<Record<string, unknown>>;
};

type Doc = Record<string, unknown>;

/** Account, plan, credits and progress on /api/v1 (read only). */
export class PublicAccountService {
  constructor(private readonly sources: AccountSources) {}

  async me(
    ownerId: string,
    key: { keyId: string; scopes: string[] },
  ): Promise<Doc> {
    const me = await this.sources.me(ownerId);
    const plan = (me.plan ?? {}) as Doc;
    const credits = (me.credits ?? {}) as Doc;
    return {
      id: me.ownerId,
      steamId: me.steamId ?? null,
      displayName: me.profile?.personaName ?? null,
      memberSince: me.memberSince ?? null,
      plan: {
        id: String(plan.id ?? "free"),
        name: String(plan.name ?? "Free"),
        status: String(plan.status ?? "active"),
      },
      credits: {
        balance: Number(credits.balance ?? 0),
        buckets: (credits.buckets as Doc | undefined) ?? {},
        costs: (credits.costs as Doc | undefined) ?? {},
      },
      usage: (me.usage as Doc | undefined) ?? {},
      uploadMaxBytes: (me.uploadMaxBytes as number | undefined) ?? null,
      apiKey: { id: key.keyId, scopes: key.scopes },
    };
  }

  ledger(ownerId: string, limit: number): Promise<{ entries: unknown[] }> {
    return this.sources.ledger(ownerId, limit);
  }

  progress(ownerId: string, map?: string): Promise<Doc> {
    return this.sources.progress(ownerId, map);
  }
}
