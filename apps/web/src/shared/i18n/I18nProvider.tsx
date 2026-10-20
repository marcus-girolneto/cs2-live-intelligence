"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  LANG_COOKIE,
  LANG_STORAGE,
  detectLang,
  htmlLang,
  isLang,
  localeOf,
  translate,
  type Dictionaries,
  type Dictionary,
  type Lang,
  type Vars,
} from "./core";
import { createFormatters } from "./format";
import { loadLangFont } from "./fonts";

/** Where a language change came from: the selector, the browser or the account. */
export type LangSource = "user" | "detected" | "account";
export type LoadDictionary = (lang: Lang) => Promise<Dictionary>;

type I18nContext = {
  lang: Lang;
  setLang: (l: Lang, source?: LangSource) => void;
  dictionaries: Dictionaries;
  /** Last explicit choice in the selector (synced to the account). */
  choice: { lang: Lang; at: number } | null;
};
const Ctx = createContext<I18nContext>({
  lang: "en",
  setLang: () => {},
  dictionaries: {},
  choice: null,
});

const noLoader: LoadDictionary = () =>
  Promise.reject(new Error("no dictionary loader"));
const readStored = (): Lang | null => {
  try {
    const v = localStorage.getItem(LANG_STORAGE);
    return isLang(v) ? v : null;
  } catch {
    return null;
  }
};
const UNSYNCED = "fragmind.lang.unsynced";
/** True when the last selector choice has not reached the account yet (survives sign-in). */
export function languageUnsynced(): boolean {
  try {
    return localStorage.getItem(UNSYNCED) === "1";
  } catch {
    return false;
  }
}
export function markLanguageSynced(): void {
  try {
    localStorage.removeItem(UNSYNCED);
  } catch {
    // Storage blocked: nothing to clear.
  }
}
const hasCookie = () =>
  document.cookie
    .split(";")
    .some((c) => c.trim().startsWith(`${LANG_COOKIE}=`));

/**
 * Active language with lazily loaded dictionaries. The server renders the cookie (or
 * Accept-Language) language with its dictionary; other languages load on demand. On a
 * first visit (no cookie, no stored choice) navigator.languages decides.
 */
export function LanguageProvider({
  initial,
  initialDictionary,
  dictionaries: preloaded,
  load = noLoader,
  detect = false,
  children,
}: {
  initial: Lang;
  /** First visit (the server had no saved choice): confirm with navigator.languages. */
  detect?: boolean;
  initialDictionary?: Dictionary;
  /** Already loaded dictionaries (tests, previews). */
  dictionaries?: Dictionaries;
  load?: LoadDictionary;
  children: ReactNode;
}) {
  const [lang, setActive] = useState<Lang>(initial);
  const [dictionaries, setDictionaries] = useState<Dictionaries>(() => ({
    ...preloaded,
    ...(initialDictionary ? { [initial]: initialDictionary } : {}),
  }));
  const [choice, setChoice] = useState<I18nContext["choice"]>(null);
  const loaded = useRef(dictionaries);
  loaded.current = dictionaries;
  const pending = useRef<Lang | null>(null);

  const setLang = useCallback(
    (next: Lang, source: LangSource = "user") => {
      document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      if (source === "user") {
        try {
          localStorage.setItem(LANG_STORAGE, next);
          localStorage.setItem(UNSYNCED, "1");
        } catch {
          // Private mode: the cookie still remembers the choice.
        }
        setChoice({ lang: next, at: Date.now() });
      }
      const apply = () => {
        if (pending.current !== next) return;
        setActive(next);
        document.documentElement.lang = htmlLang(next);
        loadLangFont(next);
      };
      pending.current = next;
      if (next === "en" || loaded.current[next]) return apply();
      load(next)
        .then((dict) => {
          setDictionaries((d) => ({ ...d, [next]: dict }));
          apply();
        })
        .catch(() => {
          // Offline or a failed chunk: stay in the current language.
          if (pending.current === next) pending.current = null;
        });
    },
    [load],
  );

  useEffect(() => {
    loadLangFont(initial);
    const stored = readStored();
    if (stored && stored !== initial) return setLang(stored, "detected");
    if (!stored && detect && !hasCookie()) {
      const detected = detectLang(navigator.languages ?? [navigator.language]);
      setLang(detected, "detected");
    }
    // Runs once on mount: later changes go through setLang.
  }, []);

  const value = useMemo(
    () => ({ lang, setLang, dictionaries, choice }),
    [lang, setLang, dictionaries, choice],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Current language, its locale, the t() translator and Intl formatters. */
export function useI18n() {
  const { lang, setLang, dictionaries } = useContext(Ctx);
  const t = useCallback(
    (text: string, vars?: Vars) => translate(dictionaries, lang, text, vars),
    [dictionaries, lang],
  );
  const locale = localeOf(lang);
  const fmt = useMemo(() => createFormatters(locale), [locale]);
  return { lang, setLang, locale, t, fmt };
}
/** The last explicit language choice (for syncing it to the account). */
export const useLanguageChoice = () => useContext(Ctx).choice;
export type Translate = ReturnType<typeof useI18n>["t"];
