import { NotFoundError } from "../../shared/errors/index.js";
import type { AuditTrail } from "../../shared/ports/audit-trail.js";
import type { CreditSettingsRepository } from "./credit-settings.repository.js";
import type {
  AdminPackView,
  CreditSettings,
  PackInput,
  PackRecord,
  PackView,
} from "./credits.dto.js";

const CACHE_MS = 10_000;

const packView = (p: PackRecord): PackView => ({
  id: p.id,
  name: p.name,
  credits: p.credits,
  prices: p.prices,
  ...(p.badge ? { badge: p.badge } : {}),
});

/**
 * Admin-editable credit numbers (welcome credits, costs, daily cap, anti-farm limits) and the
 * pack catalogue. Settings are cached briefly; every admin change invalidates the cache.
 */
export class CreditSettingsService {
  private cached?: { at: number; settings: CreditSettings };
  constructor(
    private readonly repository: CreditSettingsRepository,
    private readonly audit: AuditTrail,
    private readonly now: () => number = Date.now,
  ) {}

  async settings(): Promise<CreditSettings> {
    if (this.cached && this.now() - this.cached.at < CACHE_MS)
      return this.cached.settings;
    const settings = await this.repository.settings();
    this.cached = { at: this.now(), settings };
    return settings;
  }
  /** CreditCosts (plans comparison). */
  async costs(): Promise<{
    quickCost: number;
    deepCost: number;
    proDeepCost: number;
  }> {
    const { quickCost, deepCost, proDeepCost } = await this.settings();
    return { quickCost, deepCost, proDeepCost };
  }
  /** SafetyCap (daily review cap of the usage module). */
  async dailySafetyCap(): Promise<number> {
    return (await this.settings()).dailySafetyCap;
  }

  async update(
    adminId: string,
    patch: Partial<CreditSettings>,
  ): Promise<{ settings: CreditSettings }> {
    const next = { ...(await this.repository.settings()), ...patch };
    await this.repository.saveSettings(next);
    this.cached = undefined;
    await this.audit.record(adminId, "credits.settings", patch);
    return { settings: next };
  }

  /** Active packs in display order (GET /v1/credits/packs, 402 bodies). */
  async packs(): Promise<PackView[]> {
    return (await this.repository.packs())
      .filter((p) => p.active)
      .map(packView);
  }
  async pack(id: string): Promise<PackRecord | undefined> {
    return (await this.repository.packs()).find((p) => p.id === id);
  }
  async adminPacks(): Promise<{ packs: AdminPackView[] }> {
    return {
      packs: (await this.repository.packs()).map((p) => ({
        ...packView(p),
        stripePrices: p.stripePrices,
        active: p.active,
        sort: p.sort,
      })),
    };
  }
  async savePacks(
    adminId: string,
    packs: PackInput[],
  ): Promise<{ packs: AdminPackView[] }> {
    if (!packs.length) throw new NotFoundError("No packs given");
    await this.repository.savePacks(packs);
    await this.audit.record(adminId, "credits.packs", {
      packs: packs.map((p) => ({
        id: p.id,
        credits: p.credits,
        prices: p.prices,
        active: p.active,
      })),
    });
    return this.adminPacks();
  }
}
