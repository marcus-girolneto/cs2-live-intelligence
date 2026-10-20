import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { acceptLanguageTags, LANGUAGES } from "@cs2/contracts/languages";
import { BRAND } from "@/shared/brand";
import { LANG_COOKIE, detectLang, isLang, type Lang } from "@/shared/i18n/core";
import { LANG_FONTS } from "@/shared/i18n/fonts";
import type { Dictionary } from "@/shared/i18n";
import { loadDictionary } from "./locales";

function siteUrl() {
  try {
    return new URL(process.env.WEB_ORIGIN ?? "http://localhost:3000");
  } catch {
    return new URL("http://localhost:3000");
  }
}
const ogLocale = (tag: string) =>
  tag.includes("-") ? tag.replace("-", "_") : `${tag}_${tag.toUpperCase()}`;

/** Site-wide metadata of the root layout. */
export const rootMetadata: Metadata = {
  metadataBase: siteUrl(),
  title: {
    default: `${BRAND.name} · ${BRAND.tagline}`,
    template: `%s · ${BRAND.name}`,
  },
  description: BRAND.description,
  applicationName: BRAND.name,
  appleWebApp: { title: BRAND.name },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: `${BRAND.name} · ${BRAND.tagline}`,
    description: BRAND.description,
    locale: "en_US",
    alternateLocale: LANGUAGES.filter((l) => l.code !== "en").map((l) =>
      ogLocale(l.tag),
    ),
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND.name} · ${BRAND.tagline}`,
    description: BRAND.description,
  },
};

/**
 * The language of this request: the saved choice (cookie), else the browser's
 * Accept-Language. The client then confirms it with navigator.languages and the account.
 * Only that language's dictionary is loaded and sent with the page.
 */
export async function requestLanguage(): Promise<{
  lang: Lang;
  dictionary: Dictionary;
  font?: string;
  /** No saved choice yet: the client confirms with navigator.languages. */
  detect: boolean;
}> {
  const saved = (await cookies()).get(LANG_COOKIE)?.value;
  const lang = isLang(saved)
    ? saved
    : detectLang(acceptLanguageTags((await headers()).get("accept-language")));
  return {
    lang,
    dictionary: await loadDictionary(lang),
    font: LANG_FONTS[lang],
    detect: !isLang(saved),
  };
}
