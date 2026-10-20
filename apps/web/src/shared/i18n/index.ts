export {
  LANGS,
  LANG_COOKIE,
  LANG_STORAGE,
  detectLang,
  htmlLang,
  interpolate,
  isLang,
  localeOf,
  mergeDictionaries,
  parseLang,
  translate,
  type Dictionaries,
  type Dictionary,
  type Lang,
  type Vars,
} from "./core";
export { createFormatters, type Formatters } from "./format";
export { LANG_FONTS, loadLangFont } from "./fonts";
export {
  LanguageProvider,
  languageUnsynced,
  markLanguageSynced,
  useI18n,
  useLanguageChoice,
  type LangSource,
  type LoadDictionary,
  type Translate,
} from "./I18nProvider";
