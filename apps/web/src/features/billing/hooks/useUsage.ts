"use client";
import { useMemo } from "react";
import { useAccount } from "@/shared/session";
import {
  DEFAULT_PLANS,
  normalizeAccountPlan,
  normalizeUsage,
  type AccountPlan,
  type Usage,
} from "../model/plans";

/** Current plan + today's usage, read from the signed-in account (GET me). */
export function useUsage() {
  const { account, refresh } = useAccount();
  const plan: AccountPlan | null = useMemo(
    () => normalizeAccountPlan(account?.plan),
    [account?.plan],
  );
  const usage: Usage | null = useMemo(
    () => normalizeUsage(account?.usage),
    [account?.usage],
  );
  const catalogue = DEFAULT_PLANS.find((p) => p.id === (plan?.id ?? "free"));
  return {
    plan,
    usage,
    isAdmin: account?.role === "admin",
    /** Effective limits from GET me, else the published catalogue. */
    limits: plan?.limits ?? catalogue?.limits ?? null,
    refresh,
  };
}
