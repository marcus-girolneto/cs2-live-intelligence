"use client";
import { useEffect, useState } from "react";
import { useBillingApi } from "../api/context";
import type { BillingApi } from "../api/billing.api";
import { DEFAULT_PLANS, type Plan } from "../model/plans";

/** One catalogue request per API instance; a failure is retried on the next mount. */
const cache = new WeakMap<BillingApi, Promise<Plan[]>>();
function cachedPlans(api: BillingApi) {
  let hit = cache.get(api);
  if (!hit) {
    hit = api.getPlans().catch(() => {
      cache.delete(api);
      return DEFAULT_PLANS;
    });
    cache.set(api, hit);
  }
  return hit;
}

/**
 * Plan catalogue + whether payments are configured. The catalogue (GET plans) is public, so
 * signed-out visitors get live plans too, with the published catalogue as the fallback;
 * payment availability is only asked for signed-in accounts.
 */
export function usePlans(signedIn = true) {
  const api = useBillingApi();
  const [plans, setPlans] = useState<Plan[]>(DEFAULT_PLANS);
  const [billing, setBilling] = useState<boolean | null>(
    signedIn ? null : false,
  );
  useEffect(() => {
    let alive = true;
    void cachedPlans(api).then((p) => alive && setPlans(p));
    if (signedIn)
      api
        .getBillingStatus()
        .then((s) => alive && setBilling(s.enabled))
        .catch(() => alive && setBilling(false));
    return () => {
      alive = false;
    };
  }, [api, signedIn]);
  return { plans, billingEnabled: billing };
}
