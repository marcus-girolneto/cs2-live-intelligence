"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { LanguageSync, useAuthSession } from "@/features/auth";
import { UpgradeProvider } from "@/features/billing";
import { Landing } from "@/features/landing";
import { AppShell, PublicShell } from "@/features/shell";
import { LogoLoader, Wordmark } from "@/shared/brand";
import { useI18n } from "@/shared/i18n";
import { Refresh } from "@/shared/icons";
import { AccountProvider } from "@/shared/session";
import { Callout } from "@/shared/ui";

const PUBLIC = new Set(["/privacy", "/pricing"]);

/**
 * The app only works signed in. Without a session the visitor gets the Steam sign-in
 * landing and nothing else (the privacy notice and pricing stay public).
 */
export function AppGate({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { status, account, refresh } = useAuthSession(path);
  const ctx = { account, refresh };
  if (status === "signed-in" && account)
    return (
      <AccountProvider value={ctx}>
        <LanguageSync account={account} />
        <UpgradeProvider>
          <AppShell account={account}>{children}</AppShell>
        </UpgradeProvider>
      </AccountProvider>
    );
  if (PUBLIC.has(path) && status !== "loading")
    return (
      <AccountProvider value={ctx}>
        <PublicShell>{children}</PublicShell>
      </AccountProvider>
    );
  if (status === "loading") return <Boot />;
  if (status === "error") return <ServiceDown onRetry={() => void refresh()} />;
  return <Landing />;
}

function Boot() {
  const { t } = useI18n();
  return (
    <main className="boot" aria-busy="true">
      <LogoLoader size={88} label={t("Loading…")} />
      <Wordmark className="boot-brand" />
    </main>
  );
}

function ServiceDown({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <main className="boot">
      <div className="boot-card">
        <Callout tone="error" role="alert" title={t("Connection lost")}>
          <p>{t("The service is unavailable. Please try again.")}</p>
        </Callout>
        <button type="button" className="btn btn-ghost" onClick={onRetry}>
          <Refresh size={18} /> {t("Try again")}
        </button>
      </div>
    </main>
  );
}
