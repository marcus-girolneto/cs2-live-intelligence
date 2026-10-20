"use client";
import { SteamIdentity } from "@/features/auth";
import { DevelopersPanel } from "@/features/developers";
import { useI18n } from "@/shared/i18n";
import { Gear, User } from "@/shared/icons";
import { Callout, PageHeader, Panel, Skeleton } from "@/shared/ui";
import { useSettings } from "../hooks/useSettings";
import { AutoReviewPanel } from "./AutoReviewPanel";
import { CoachSettings } from "./CoachSettings";
import { DangerPanel } from "./DangerPanel";
import { DevicesPanel } from "./DevicesPanel";
import { PrivacyPanel } from "./PrivacyPanel";
/** /settings: Steam account, coach personality, consent/retention, devices, API and deletion. */
export function SettingsScreen() {
  const { t } = useI18n();
  const vm = useSettings();
  const { account, error, notice } = vm;
  const sections = [
    ["steam", t("Steam account")],
    ["coach", t("AI coach personality")],
    ["privacy", t("Consent & retention")],
    ["devices", t("Collector devices")],
    ["developers", t("Developers")],
    ["danger", t("Delete account & data")],
  ] as const;
  return (
    <main className="page settings-page">
      <PageHeader
        eyebrow={t("Account & data")}
        icon={<Gear size={16} />}
        title={t("Settings")}
        lead={t(
          "Your Steam identity, how your coach talks to you, your devices and what happens to your data.",
        )}
      />
      {error && (
        <Callout tone="error" role="alert">
          {error}
        </Callout>
      )}
      {notice && (
        <Callout tone="success" role="status">
          {notice}
        </Callout>
      )}
      <div className="settings-layout">
        <nav className="settings-nav" aria-label={t("Settings sections")}>
          {sections.map(([id, label]) => (
            <a key={id} href={`#${id}`}>
              {label}
            </a>
          ))}
        </nav>
        <div className="settings-body">
          <Panel
            id="steam"
            icon={<User size={20} />}
            title={t("Steam account")}
          >
            {account ? (
              <SteamIdentity account={account} compact />
            ) : (
              <Skeleton height={140} />
            )}
          </Panel>
          <CoachSettings />
          <AutoReviewPanel />
          <PrivacyPanel vm={vm} />
          <DevicesPanel vm={vm} />
          <DevelopersPanel />
          <DangerPanel vm={vm} />
        </div>
      </div>
    </main>
  );
}
