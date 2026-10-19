import { platformHttp, type HttpClient } from "@/shared/http";
import type {
  BillingStatusDto,
  PlanView,
  RedirectDto,
} from "@/shared/api-types";
import {
  normalizeLedger,
  normalizePacks,
  normalizePlans,
  type CreditPack,
  type LedgerEntry,
  type Currency,
  type Interval,
  type Plan,
  type PlanId,
} from "../model/plans";

/** Plans catalogue, payment availability and Stripe redirects. */
export interface BillingApi {
  /** Public plan catalogue (falls back to the published v1 plans when unusable). */
  getPlans(): Promise<Plan[]>;
  getBillingStatus(): Promise<{ enabled: boolean }>;
  /** Stripe Checkout URL (validated). */
  startCheckout(
    planId: PlanId,
    interval: Interval,
    currency: Currency,
  ): Promise<string>;
  /** Stripe Customer Portal URL (validated). */
  openPortal(): Promise<string>;
  /** Credit movements of the signed-in account, newest first. */
  getLedger(limit?: number): Promise<LedgerEntry[]>;
  /** Credit packs on sale. */
  getPacks(): Promise<CreditPack[]>;
  /** Stripe Checkout URL for one credit pack (validated). */
  buyCredits(packId: string, currency: Currency): Promise<string>;
}

/** Only https destinations (or same-origin) are followed (Stripe Checkout / Customer Portal). */
export function safeRedirect(url: unknown, origin = window.location.origin) {
  if (typeof url !== "string") throw new Error("Checkout is unavailable.");
  const u = new URL(url, origin);
  if (u.protocol !== "https:" && u.origin !== origin)
    throw new Error("Checkout is unavailable.");
  return u.href;
}

export function createBillingApi(http: HttpClient = platformHttp): BillingApi {
  return {
    async getPlans() {
      return normalizePlans(
        await http.get<{ plans: PlanView[] } | unknown>("plans"),
      );
    },
    async getBillingStatus() {
      const r = await http.get<Partial<BillingStatusDto> | undefined>(
        "billing/status",
      );
      return { enabled: r?.enabled === true };
    },
    async startCheckout(planId, interval, currency) {
      const r = await http.post<Partial<RedirectDto> | undefined>(
        "billing/checkout",
        { planId, interval, currency },
      );
      return safeRedirect(r?.url);
    },
    async openPortal() {
      const r = await http.post<Partial<RedirectDto> | undefined>(
        "billing/portal",
        {},
      );
      return safeRedirect(r?.url);
    },
    async getLedger(limit = 50) {
      return normalizeLedger(
        await http.get<unknown>("credits/ledger", { query: { limit } }),
      );
    },
    async getPacks() {
      return normalizePacks(await http.get<unknown>("credits/packs"));
    },
    async buyCredits(packId, currency) {
      const r = await http.post<Partial<RedirectDto> | undefined>(
        "billing/credits/checkout",
        { packId, currency },
      );
      return safeRedirect(r?.url);
    },
  };
}

export const billingApi = createBillingApi();
