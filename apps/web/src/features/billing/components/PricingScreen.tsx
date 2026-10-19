"use client";
import type { ReactNode } from "react";
import { useAccount } from "@/shared/session";
import { useUsage } from "../hooks/useUsage";
import { PricingSection } from "./PricingSection";

/** Public /pricing page (the sign-in button is injected so billing stays auth-free). */
export function PricingScreen({ signIn }: { signIn: ReactNode }) {
  const { account } = useAccount();
  const { plan } = useUsage();
  return (
    <main className="page pricing-page">
      <PricingSection
        headingLevel={1}
        signedIn={!!account}
        plan={plan}
        signIn={signIn}
      />
    </main>
  );
}
