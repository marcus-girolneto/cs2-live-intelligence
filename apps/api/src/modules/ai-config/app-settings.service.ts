import type { AuditTrail } from "../../shared/ports/audit-trail.js";
import type { AppSettings } from "./ai-config.dto.js";
import type { AiConfigRepository } from "./ai-config.repository.js";
import type { AiSettingsService } from "./ai-settings.service.js";

export type AppSettingsViewDto = {
  settings: AppSettings;
  updatedAt: string | null;
  effective: {
    dailyLimit: number | null;
    maxInputBytes: number | null;
    sampleDemoEnabled: boolean;
    sampleDemoConfigured: boolean;
    aiSource: { review: "database" | "env"; live: "database" | "env" };
  };
};

/** GET/PUT /v1/admin/settings: stored settings plus the values in effect. */
export class AppSettingsService {
  constructor(
    private readonly repository: AiConfigRepository,
    private readonly ai: AiSettingsService,
    private readonly audit: AuditTrail,
    private readonly sampleDemoConfigured: () => boolean,
  ) {}

  async view(): Promise<AppSettingsViewDto> {
    this.ai.invalidate();
    const snap = await this.ai.load();
    const [review, live] = await Promise.all([
      this.ai.resolve("review"),
      this.ai.resolve("live"),
    ]);
    return {
      settings: snap.settings,
      updatedAt: snap.settingsUpdatedAt,
      effective: {
        dailyLimit: review.result.ok
          ? review.result.config.dailyLimit
          : snap.settings.dailyLimit,
        maxInputBytes: review.result.ok
          ? review.result.config.maxInputBytes
          : snap.settings.maxInputBytes,
        sampleDemoEnabled: snap.settings.sampleDemoEnabled,
        sampleDemoConfigured: this.sampleDemoConfigured(),
        aiSource: { review: review.source, live: live.source },
      },
    };
  }

  async update(
    adminId: string,
    patch: Partial<AppSettings>,
  ): Promise<AppSettingsViewDto> {
    const current = await this.ai.settings();
    await this.repository.saveAppSettings({ ...current, ...patch });
    this.ai.invalidate();
    await this.audit.record(adminId, "settings.update", patch);
    return this.view();
  }
}
