// Public API of the billing feature: plans, usage, upgrade sheet, pricing and checkout.
export { createBillingApi, type BillingApi } from "./api/billing.api";
export { BillingApiProvider, useBillingApi } from "./api/context";
export { BillingResult } from "./components/BillingResult";
export { BillingScreen } from "./components/BillingScreen";
export { PlanBadge } from "./components/PlanBadge";
export { PlanFeatures } from "./components/PlanFeatures";
export { PricingScreen } from "./components/PricingScreen";
export { PricingSection } from "./components/PricingSection";
export { UsageMeter } from "./components/UsageMeter";
export { useCheckout } from "./hooks/useCheckout";
export { usePlans } from "./hooks/usePlans";
export { UpgradeProvider, useUpgrade } from "./hooks/useUpgrade";
export { useUsage } from "./hooks/useUsage";
/** Shared clock hook, re-exported for existing callers. */
export { useNow } from "@/shared/hooks";
export {
  DEFAULT_PLANS,
  currencyFor,
  formatPrice,
  isPaid,
  normalizePlans,
  planUpdateBody,
  planLimitFrom,
  remaining,
  resetsIn,
  type AccountPlan,
  type Currency,
  type Interval,
  type Plan,
  type PlanLimitError,
  type PlanId,
  type PlanLimits,
  type Usage,
} from "./model/plans";
/** Portuguese dictionary of this feature (merged by src/composition/i18n.ts). */
export { pt as i18nPt } from "./i18n/pt";
