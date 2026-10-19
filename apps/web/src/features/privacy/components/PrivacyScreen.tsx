"use client";
import Link from "next/link";
import { useI18n } from "@/shared/i18n";
import { Lock } from "@/shared/icons";
import { useAccount } from "@/shared/session";
import { PageHeader, Panel } from "@/shared/ui";
import { privacyNotice } from "../model/privacy";
export function PrivacyScreen() {
  const { t } = useI18n();
  const { account } = useAccount();
  return (
    <main className="page narrow privacy-page">
      <PageHeader
        eyebrow={t("Local installation")}
        icon={<Lock size={16} />}
        title={t("Privacy")}
        lead={t("How this local demonstration handles match information.")}
      />
      {privacyNotice.map((section) => (
        <Panel key={section.title} title={section.title} className="flat">
          <p className="muted">{section.text}</p>
        </Panel>
      ))}
      <p>
        {account ? (
          <Link href="/settings#privacy">
            {t("Manage consent, retention and account deletion")} →
          </Link>
        ) : (
          <Link href="/">← {t("Back")}</Link>
        )}
      </p>
    </main>
  );
}
