import { platformHttp, type HttpClient } from "@/shared/http";
import type {
  BillingStatusDto,
  PlanView,
  RedirectDto,
} from "@/shared/api-types";
import {
  normalizePlans,
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
  };
}

export const billingApi = createBillingApi();
