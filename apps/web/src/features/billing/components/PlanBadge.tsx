"use client";
import { Crown } from "@/shared/icons";
import type { AccountPlan } from "../model/plans";

export function PlanBadge({ plan }: { plan: AccountPlan | null }) {
  const id = plan?.id ?? "free";
  return (
    <span className={`plan-badge plan-${id.replace(/[^a-z0-9]/gi, "")}`}>
      {id !== "free" && <Crown size={13} />}
      {plan?.name ?? "Free"}
    </span>
  );
}
