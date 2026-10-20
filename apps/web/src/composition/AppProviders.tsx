"use client";
import type { ReactNode } from "react";
import { LanguageProvider, type Dictionary, type Lang } from "@/shared/i18n";
import { AppGate } from "./AppGate";
import { loadDictionary } from "./locales";

/** Root client providers: language (lazily loaded dictionaries) and the auth gate. */
export function AppProviders({
  lang,
  dictionary,
  detect,
  children,
}: {
  lang: Lang;
  /** Dictionary of `lang`, loaded on the server so the first paint is translated. */
  dictionary: Dictionary;
  /** No saved choice yet: confirm the language with navigator.languages. */
  detect: boolean;
  children: ReactNode;
}) {
  return (
    <LanguageProvider
      initial={lang}
      initialDictionary={dictionary}
      load={loadDictionary}
      detect={detect}
    >
      <AppGate>{children}</AppGate>
    </LanguageProvider>
  );
}
