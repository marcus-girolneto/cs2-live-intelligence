"use client";
import { useEffect, useRef } from "react";
import {
  isLang,
  languageUnsynced,
  markLanguageSynced,
  useI18n,
  useLanguageChoice,
} from "@/shared/i18n";
import type { Account } from "@/shared/session";
import { useAuthApi } from "../api/context";

/**
 * Keeps the selector language and the account language in step. On sign-in a choice made
 * before (still unsynced) is saved to the account; otherwise the account language wins, so
 * every device shows the same language. Later choices are saved as they happen.
 */
export function useLanguageSync(account: Account): void {
  const { lang, setLang } = useI18n();
  const choice = useLanguageChoice();
  const api = useAuthApi();
  const owner = useRef<string | null>(null);
  const save = (next: string) =>
    api
      .saveLanguage(next)
      .then(markLanguageSynced)
      .catch(() => {
        // Offline: the next choice or sign-in retries.
      });

  useEffect(() => {
    if (owner.current === account.ownerId) return;
    owner.current = account.ownerId;
    const saved = isLang(account.lang) ? account.lang : null;
    if (saved && !languageUnsynced()) {
      if (saved !== lang) setLang(saved, "account");
    } else if (saved !== lang) void save(lang);
    else markLanguageSynced();
    // Once per signed-in account; choices are handled below.
  }, [account.ownerId]);

  useEffect(() => {
    if (choice && owner.current) void save(choice.lang);
  }, [choice]);
}

/** Mount point for the sync inside the signed-in app. */
export function LanguageSync({ account }: { account: Account }) {
  useLanguageSync(account);
  return null;
}
