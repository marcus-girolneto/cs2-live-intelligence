import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { AppProviders } from "@/composition/AppProviders";
import { BRAND } from "@/shared/brand";
import { LANG_COOKIE, parseLang } from "@/shared/i18n/core";
function siteUrl() {
  try {
    return new URL(process.env.WEB_ORIGIN ?? "http://localhost:3000");
  } catch {
    return new URL("http://localhost:3000");
  }
}
export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: {
    default: `${BRAND.name} — ${BRAND.tagline.en}`,
    template: `%s · ${BRAND.name}`,
  },
  description: BRAND.description.en,
  applicationName: BRAND.name,
  appleWebApp: { title: BRAND.name },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: `${BRAND.name} — ${BRAND.tagline.en}`,
    description: BRAND.description.en,
    locale: "en_US",
    alternateLocale: ["pt_BR"],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND.name} — ${BRAND.tagline.en}`,
    description: BRAND.description.en,
  },
};
export const viewport: Viewport = { themeColor: BRAND.themeColor };
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const lang = parseLang((await cookies()).get(LANG_COOKIE)?.value);
  return (
    <html lang={lang === "pt" ? "pt-BR" : "en"}>
      <body>
        <AppProviders lang={lang}>{children}</AppProviders>
      </body>
    </html>
  );
}
