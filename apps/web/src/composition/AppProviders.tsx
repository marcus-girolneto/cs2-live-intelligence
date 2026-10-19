"use client";
import type { ReactNode } from "react";
import { LanguageProvider, type Lang } from "@/shared/i18n";
import { AppGate } from "./AppGate";
import { dictionaries } from "./i18n";

/** Root client providers: language (merged feature dictionaries) and the auth gate. */
export function AppProviders({
  lang,
  children,
}: {
  lang: Lang;
  children: ReactNode;
}) {
  return (
    <LanguageProvider initial={lang} dictionaries={dictionaries}>
      <AppGate>{children}</AppGate>
    </LanguageProvider>
  );
}
