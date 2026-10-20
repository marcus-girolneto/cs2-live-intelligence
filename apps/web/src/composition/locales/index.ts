// One lazily loaded chunk per language; English needs no dictionary (keys are English).
import type { Dictionary, Lang } from "@/shared/i18n";

type Bundle = { dictionary: Dictionary };
const LOADERS: Record<Exclude<Lang, "en">, () => Promise<Bundle>> = {
  pt: () => import("./pt"),
  es: () => import("./es"),
  ru: () => import("./ru"),
  zh: () => import("./zh"),
  de: () => import("./de"),
  fr: () => import("./fr"),
  pl: () => import("./pl"),
  tr: () => import("./tr"),
};

export async function loadDictionary(lang: Lang): Promise<Dictionary> {
  if (lang === "en") return {};
  return (await LOADERS[lang]()).dictionary;
}
