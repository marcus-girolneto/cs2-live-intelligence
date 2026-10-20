import type { Viewport } from "next";
import "./globals.css";
import { AppProviders } from "@/composition/AppProviders";
import { requestLanguage, rootMetadata } from "@/composition/rootLayout";
import { BRAND } from "@/shared/brand";
import { htmlLang } from "@/shared/i18n/core";

export const metadata = rootMetadata;
export const viewport: Viewport = { themeColor: BRAND.themeColor };
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { lang, dictionary, font, detect } = await requestLanguage();
  return (
    <html lang={htmlLang(lang)}>
      {font && (
        <head>
          <link rel="stylesheet" href={font} data-lang-font={lang} />
        </head>
      )}
      <body>
        <AppProviders lang={lang} dictionary={dictionary} detect={detect}>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
