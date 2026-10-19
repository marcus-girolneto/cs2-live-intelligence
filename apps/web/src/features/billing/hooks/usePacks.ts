"use client";
import { useEffect, useState } from "react";
import { useBillingApi } from "../api/context";
import type { BillingApi } from "../api/billing.api";
import { DEFAULT_PACKS, type CreditPack } from "../model/plans";

const cache = new WeakMap<BillingApi, Promise<CreditPack[]>>();
function cachedPacks(api: BillingApi) {
  let hit = cache.get(api);
  if (!hit) {
    hit = api.getPacks().catch(() => {
      cache.delete(api);
      return [];
    });
    cache.set(api, hit);
  }
  return hit;
}

/**
 * Credit packs on sale. `live` is false while loading or when the endpoint has none: the
 * published packs are shown instead and buying stays disabled.
 */
export function usePacks() {
  const api = useBillingApi();
  const [packs, setPacks] = useState<CreditPack[] | null>(null);
  useEffect(() => {
    let alive = true;
    void cachedPacks(api).then((p) => alive && setPacks(p));
    return () => {
      alive = false;
    };
  }, [api]);
  const live = !!packs && packs.length > 0;
  return { packs: live ? packs : DEFAULT_PACKS, live, loading: packs === null };
}
