/** Absolute ceiling for demo uploads (route body limit; MAX_UPLOAD_BYTES may lower it). */
export const MAX_UPLOAD_CAP = 1024 * 1024 * 1024;
/** Product default: 500 MB (524288000 bytes), admin-editable (app setting maxDemoBytes). */
export const DEFAULT_MAX_DEMO_BYTES = 524_288_000;

/** Port (ai-config app settings): the admin-editable demo size limit. */
export interface DemoSizeSetting {
  settings(): Promise<{ maxDemoBytes: number }>;
}

/**
 * The effective demo upload limit: the admin setting clamped to the deployment ceiling
 * (MAX_UPLOAD_BYTES, at most 1 GiB). Shown on GET /v1/plans and /v1/me.
 */
export class UploadLimits {
  constructor(
    private readonly setting: DemoSizeSetting,
    readonly ceiling: number,
  ) {
    if (!Number.isInteger(ceiling) || ceiling < 1 || ceiling > MAX_UPLOAD_CAP)
      throw new Error("Upload cap must be 1 byte..1 GiB");
  }
  async maxDemoBytes(): Promise<number> {
    const configured = (await this.setting.settings()).maxDemoBytes;
    return Math.min(this.ceiling, configured ?? DEFAULT_MAX_DEMO_BYTES);
  }
}
