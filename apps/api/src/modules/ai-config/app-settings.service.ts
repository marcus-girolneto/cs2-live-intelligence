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
    /** Day boundary in effect for plans, quotas and credits. */
    timezone?: string;
    aiSource: {
      review: "database" | "env";
      review_quick: "database" | "env";
      review_deep: "database" | "env";
      live: "database" | "env";
      report: "database" | "env";
      personal_coach: "database" | "env";
    };
  };
};

/** GET/PUT /v1/admin/settings: stored settings plus the values in effect. */
export class AppSettingsService {
  constructor(
    private readonly repository: AiConfigRepository,
    private readonly ai: AiSettingsService,
    private readonly audit: AuditTrail,
    private readonly sampleDemoConfigured: () => boolean,
    /** Optional: the app clock's zone (refreshed after a settings change). */
    private readonly timeZone?: {
      current(): string;
      refresh(): Promise<void>;
    },
  ) {}

  async view(): Promise<AppSettingsViewDto> {
    this.ai.invalidate();
    const snap = await this.ai.load();
    const [review, deep, live, report, coach] = await Promise.all([
      this.ai.resolve("review_quick"),
      this.ai.resolve("review_deep"),
      this.ai.resolve("live"),
      this.ai.resolve("report"),
      this.ai.resolve("personal_coach"),
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
        ...(this.timeZone ? { timezone: this.timeZone.current() } : {}),
        aiSource: {
          review: review.source,
          review_quick: review.source,
          review_deep: deep.source,
          live: live.source,
          report: report.source,
          personal_coach: coach.source,
        },
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
    await this.timeZone?.refresh();
    await this.audit.record(adminId, "settings.update", patch);
    return this.view();
  }
}
