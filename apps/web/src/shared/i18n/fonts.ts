import type { Lang } from "./core";

/**
 * Rajdhani (display) has no Cyrillic or CJK glyphs. Russian uses Exo 2 and Chinese uses
 * Noto Sans SC for headings (see base.css :lang rules), loaded only for those languages.
 */
export const LANG_FONTS: Partial<Record<Lang, string>> = {
  ru: "https://fonts.googleapis.com/css2?family=Exo+2:wght@500;600;700&display=swap",
  zh: "https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap",
};

export function loadLangFont(lang: Lang) {
  const href = LANG_FONTS[lang];
  if (!href || typeof document === "undefined") return;
  if (document.querySelector(`link[data-lang-font="${lang}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.dataset.langFont = lang;
  document.head.appendChild(link);
}
