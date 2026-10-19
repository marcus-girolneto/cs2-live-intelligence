"use client";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  LANG_COOKIE,
  localeOf,
  translate,
  type Dictionaries,
  type Lang,
  type Vars,
} from "./core";

type I18nContext = {
  lang: Lang;
  setLang: (l: Lang) => void;
  dictionaries: Dictionaries;
};
const EMPTY: Dictionaries = { en: {}, pt: {} };
const Ctx = createContext<I18nContext>({
  lang: "en",
  setLang: () => {},
  dictionaries: EMPTY,
});

export function LanguageProvider({
  initial,
  dictionaries,
  children,
}: {
  initial: Lang;
  dictionaries: Dictionaries;
  children: ReactNode;
}) {
  const [lang, set] = useState<Lang>(initial);
  const setLang = useCallback((next: Lang) => {
    set(next);
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = next === "pt" ? "pt-BR" : "en";
  }, []);
  const value = useMemo(
    () => ({ lang, setLang, dictionaries }),
    [lang, setLang, dictionaries],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Current language, its locale and the t() translator. */
export function useI18n() {
  const { lang, setLang, dictionaries } = useContext(Ctx);
  const t = useCallback(
    (text: string, vars?: Vars) => translate(dictionaries, lang, text, vars),
    [dictionaries, lang],
  );
  return { lang, setLang, locale: localeOf(lang), t };
}
export type Translate = ReturnType<typeof useI18n>["t"];
