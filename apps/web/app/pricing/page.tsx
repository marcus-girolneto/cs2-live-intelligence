"use client";
import { SteamSignIn } from "@/features/auth";
import { PricingScreen } from "@/features/billing";

export default function PricingPage() {
  return <PricingScreen signIn={<SteamSignIn size="md" />} />;
}
