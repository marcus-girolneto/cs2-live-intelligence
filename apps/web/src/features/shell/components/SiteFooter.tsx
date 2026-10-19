"use client";
import Link from "next/link";
import { LogoMark, Wordmark } from "@/shared/brand";
import { useI18n } from "@/shared/i18n";
export function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <span className="footer-brand">
          <LogoMark size={20} /> <Wordmark />
        </span>
        <span>
          {t(
            "Independent project, not affiliated with Valve. Counter-Strike 2 and its artwork are trademarks of Valve Corporation.",
          )}
        </span>
        <span className="footer-links">
          <Link href="/pricing">{t("Pricing")}</Link>
          <Link href="/privacy">{t("Privacy")}</Link>
        </span>
      </div>
    </footer>
  );
}
