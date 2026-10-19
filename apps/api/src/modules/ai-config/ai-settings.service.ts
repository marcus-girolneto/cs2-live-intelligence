import type { AiConfigResult } from "@cs2/coaching";
import {
  appSettingsSchema,
  DEFAULT_APP_SETTINGS,
  PURPOSE_FALLBACK,
  type AiPurpose,
  type AppSettings,
  type AssignmentMap,
} from "./ai-config.dto.js";
import type { AiConfigFactory } from "./ai-config.factory.js";
import type {
  AiConfigRepository,
  AiProviderRecord,
} from "./ai-config.repository.js";

export interface AiSnapshot {
  at: number;
  providers: AiProviderRecord[];
  assignments: AssignmentMap;
  settings: AppSettings;
  settingsUpdatedAt: string | null;
}
export interface ResolvedAi {
  purpose: AiPurpose;
  source: "database" | "env";
  providerId?: string;
  providerName?: string;
  result: AiConfigResult;
}

/** Strategy: one way of producing the config for a purpose (undefined = not applicable). */
export interface AiConfigSource {
  resolve(purpose: AiPurpose, snapshot: AiSnapshot): ResolvedAi | undefined;
}

/** The admin's assignment (provider profile + model) for the purpose. */
export class AssignedProviderSource implements AiConfigSource {
  constructor(private readonly factory: AiConfigFactory) {}
  resolve(purpose: AiPurpose, snap: AiSnapshot): ResolvedAi | undefined {
    // Follow the fallback chain (e.g. personal_coach → review_deep → review_quick).
    let assignment = snap.assignments[purpose];
    for (
      let p = PURPOSE_FALLBACK[purpose];
      !assignment && p;
      p = PURPOSE_FALLBACK[p]
    )
      assignment = snap.assignments[p];
    const row = assignment
      ? snap.providers.find((p) => p.id === assignment.providerId)
      : undefined;
    if (!assignment || !row) return undefined;
    return {
      purpose,
      source: "database",
      providerId: row.id,
      providerName: row.name,
      result: this.factory.fromProvider(row, assignment.model, snap.settings),
    };
  }
}

/** The AI_* environment: always applicable, so it ends the chain. */
export class EnvironmentSource implements AiConfigSource {
  constructor(private readonly factory: AiConfigFactory) {}
  resolve(purpose: AiPurpose, snap: AiSnapshot): ResolvedAi {
    return {
      purpose,
      source: "env",
      result: this.factory.fromEnvironment(snap.settings),
    };
  }
}

/**
 * Admin-managed AI configuration (Postgres) with the AI_* environment as fallback. The
 * database snapshot is cached in memory, invalidated on every admin change and expires after
 * a short TTL (multi-instance deployments).
 */
export class AiSettingsService {
  private snapshot?: AiSnapshot;
  private loading?: Promise<AiSnapshot>;
  constructor(
    private readonly repository: AiConfigRepository,
    private readonly sources: AiConfigSource[],
    private readonly ttlMs = 30_000,
    private readonly now: () => number = Date.now,
  ) {}

  invalidate(): void {
    this.snapshot = undefined;
    this.loading = undefined;
  }

  async load(): Promise<AiSnapshot> {
    if (this.snapshot && this.now() - this.snapshot.at < this.ttlMs)
      return this.snapshot;
    this.loading ??= this.read();
    const loading = this.loading;
    try {
      const snapshot = await loading;
      if (this.loading === loading) this.snapshot = snapshot;
      return snapshot;
    } finally {
      if (this.loading === loading) this.loading = undefined;
    }
  }

  async settings(): Promise<AppSettings> {
    return (await this.load()).settings;
  }

  async sampleDemoEnabled(): Promise<boolean> {
    return (await this.settings()).sampleDemoEnabled;
  }

  /** The first applicable source wins (assignment, then environment). */
  async resolve(purpose: AiPurpose): Promise<ResolvedAi> {
    const snap = await this.load();
    for (const source of this.sources) {
      const resolved = source.resolve(purpose, snap);
      if (resolved) return resolved;
    }
    throw new Error(`No AI configuration source for ${purpose}`);
  }

  private async read(): Promise<AiSnapshot> {
    const [providers, assignments, stored] = await Promise.all([
      this.repository.providers(),
      this.repository.assignments(),
      this.repository.appSettings(),
    ]);
    const parsed = appSettingsSchema.partial().safeParse(stored.settings ?? {});
    return {
      at: this.now(),
      providers,
      assignments,
      settings: {
        ...DEFAULT_APP_SETTINGS,
        ...(parsed.success ? parsed.data : {}),
      },
      settingsUpdatedAt: stored.updatedAt,
    };
  }
}
