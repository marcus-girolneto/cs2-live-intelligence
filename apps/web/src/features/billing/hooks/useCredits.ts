"use client";
import { useMemo } from "react";
import { useAccount } from "@/shared/session";
import { normalizeCredits, tierCost, type ReviewTier } from "../model/plans";
import { useUsage } from "./useUsage";

/** Credit balance of the signed-in account (GET me) and what each review tier costs. */
export function useCredits() {
  const { account, refresh } = useAccount();
  const { plan, limits, isAdmin } = useUsage();
  const credits = useMemo(
    () => normalizeCredits(account?.credits),
    [account?.credits],
  );
  const cost = (tier: ReviewTier) =>
    tierCost(
      credits,
      tier,
      plan ? { id: plan.id, limits: limits ?? {} } : null,
    );
  return {
    credits,
    /** null while the API does not report credits (older backend). */
    balance: credits?.balance ?? null,
    cost,
    /** Admins run reviews without spending credits. */
    isAdmin,
    /** Whether the balance covers a tier (unknown balance never blocks: the API decides). */
    canAfford: (tier: ReviewTier) =>
      isAdmin || credits === null || credits.balance >= cost(tier),
    refresh,
  };
}
