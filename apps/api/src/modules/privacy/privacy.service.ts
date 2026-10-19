import type { OwnerInvalidation } from "../live/owner-invalidation.js";
import type { SettingsDto } from "./privacy.dto.js";
import type { PrivacyRepository } from "./privacy.repository.js";

/** Port (plans): the retention an account may keep, given what it asked for. */
export interface RetentionLimit {
  clampRetention(ownerId: string, requestedDays: number): Promise<number>;
}

/** Consent, retention and account deletion (GDPR-style controls). */
export class PrivacyService {
  constructor(
    private readonly privacy: PrivacyRepository,
    private readonly invalidation: OwnerInvalidation,
    private readonly retention?: RetentionLimit,
  ) {}

  settings(ownerId: string): Promise<SettingsDto> {
    return this.privacy.settings(ownerId);
  }

  async update(ownerId: string, requested: SettingsDto): Promise<SettingsDto> {
    const settings: SettingsDto = {
      ...requested,
      retentionDays: this.retention
        ? await this.retention.clampRetention(ownerId, requested.retentionDays)
        : requested.retentionDays,
    };
    await this.privacy.update(ownerId, settings);
    // Without consent no live data may keep flowing to open browser channels.
    if (!settings.telemetryConsent) this.invalidation.invalidate(ownerId);
    return settings;
  }

  async deleteAccount(ownerId: string): Promise<void> {
    await this.privacy.deleteAccount(ownerId);
    this.invalidation.invalidate(ownerId);
  }
}
