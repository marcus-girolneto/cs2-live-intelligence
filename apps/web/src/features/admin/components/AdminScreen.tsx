"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Brain,
  Coin,
  Crown,
  Gear,
  Key,
  ListIcon,
  Lock,
  Server,
  Users,
} from "@/shared/icons";
import { useAccount } from "@/shared/session";
import { EmptyState, PageHeader, TabPanel, Tabs } from "@/shared/ui";
import { useResource } from "../hooks/useResource";
import type { AiStatus, ProvidersResponse } from "../model/types";
import { ActiveConfig } from "./ActiveConfig";
import { AiQualityPanel } from "./AiQualityPanel";
import { AssignmentsPanel } from "./AssignmentsPanel";
import { AuditPanel } from "./AuditPanel";
import { CreditPacksEditor } from "./CreditPacksEditor";
import { CreditSettingsPanel } from "./CreditSettingsPanel";
import { IntegrationsPanel } from "./integrations/IntegrationsPanel";
import { PlansEditor } from "./PlansEditor";
import { ProvidersList } from "./ProvidersList";
import { SettingsPanel } from "./SettingsPanel";
import { UsersPanel } from "./UsersPanel";
import { useI18n } from "@/shared/i18n";

type Tab =
  | "providers"
  | "assignments"
  | "settings"
  | "plans"
  | "credits"
  | "integrations"
  | "users"
  | "audit";
const TABS: Tab[] = [
  "providers",
  "assignments",
  "settings",
  "plans",
  "credits",
  "integrations",
  "users",
  "audit",
];
const ID = "admin";

/** /admin: AI providers, model assignment, app settings, plans, users and audit. */
export function AdminScreen() {
  const { t } = useI18n();
  const { account } = useAccount();
  const [tab, setTab] = useState<Tab>("providers");
  const [forbidden, setForbidden] = useState(false);
  const deny = useCallback(() => setForbidden(true), []);
  useEffect(() => {
    const wanted = window.location.hash.slice(1) as Tab;
    if (TABS.includes(wanted)) setTab(wanted);
  }, []);
  function choose(next: Tab) {
    setTab(next);
    history.replaceState(null, "", `#${next}`);
  }
  if (account && account.role !== "admin") return <Forbidden />;
  if (forbidden) return <Forbidden />;
  return (
    <main className="page admin-page">
      <PageHeader
        eyebrow={t("Administration")}
        icon={<Server size={16} />}
        title={t("Control room")}
        lead={t(
          "Models, endpoints, credentials and app-wide settings for every player on this installation. Players only choose their own coaching approach.",
        )}
      />
      <Tabs
        idBase={ID}
        label={t("Admin sections")}
        value={tab}
        onChange={choose}
        tabs={[
          { id: "providers", label: t("AI providers"), icon: <Server /> },
          { id: "assignments", label: t("Model assignment"), icon: <Brain /> },
          { id: "settings", label: t("App settings"), icon: <Gear /> },
          { id: "plans", label: t("Plans"), icon: <Crown /> },
          { id: "credits", label: t("Credits"), icon: <Coin /> },
          { id: "integrations", label: t("Integrations"), icon: <Key /> },
          { id: "users", label: t("Users & roles"), icon: <Users /> },
          { id: "audit", label: t("Audit log"), icon: <ListIcon /> },
        ]}
      />
      {(tab === "providers" || tab === "assignments") && (
        <AiTabs tab={tab} onForbidden={deny} />
      )}
      {tab === "settings" && (
        <TabPanel idBase={ID} id="settings">
          <SettingsPanel onForbidden={deny} />
        </TabPanel>
      )}
      {tab === "plans" && (
        <TabPanel idBase={ID} id="plans">
          <PlansEditor onForbidden={deny} />
        </TabPanel>
      )}
      {tab === "integrations" && (
        <TabPanel idBase={ID} id="integrations">
          <IntegrationsPanel onForbidden={deny} />
        </TabPanel>
      )}
      {tab === "credits" && (
        <TabPanel idBase={ID} id="credits">
          <div className="adm-stack">
            <CreditSettingsPanel onForbidden={deny} />
            <CreditPacksEditor onForbidden={deny} />
          </div>
        </TabPanel>
      )}
      {tab === "users" && (
        <TabPanel idBase={ID} id="users">
          <UsersPanel onForbidden={deny} selfId={account?.ownerId} />
        </TabPanel>
      )}
      {tab === "audit" && (
        <TabPanel idBase={ID} id="audit">
          <AuditPanel onForbidden={deny} />
        </TabPanel>
      )}
    </main>
  );
}

function AiTabs({
  tab,
  onForbidden,
}: {
  tab: "providers" | "assignments";
  onForbidden: () => void;
}) {
  const providers = useResource<ProvidersResponse>(
    "admin/ai/providers",
    onForbidden,
  );
  const status = useResource<AiStatus>("ai/status", () => {});
  const reloadProviders = providers.reload;
  const reloadStatus = status.reload;
  const reload = useCallback(
    () => Promise.all([reloadProviders(), reloadStatus()]),
    [reloadProviders, reloadStatus],
  );
  const list = providers.data?.providers ?? [];
  if (tab === "providers")
    return (
      <TabPanel idBase={ID} id="providers">
        <ActiveConfig
          status={status.data}
          loading={status.loading}
          error={status.error}
        />
        <ProvidersList
          providers={list}
          loading={providers.loading}
          onChanged={reload}
        />
        <AiQualityPanel />
      </TabPanel>
    );
  return (
    <TabPanel idBase={ID} id="assignments">
      <AssignmentsPanel
        providers={list}
        assignments={providers.data?.assignments ?? {}}
        status={status.data}
        loading={providers.loading}
        onSaved={reload}
      />
    </TabPanel>
  );
}

function Forbidden() {
  const { t } = useI18n();
  return (
    <main className="page narrow admin-page">
      <div className="adm-403">
        <span className="adm-403-code" aria-hidden>
          403
        </span>
        <EmptyState
          icon={<Lock size={28} />}
          title={t("Restricted area")}
          actions={
            <Link className="btn btn-primary" href="/">
              {t("Back to dashboard")} <ArrowRight size={18} />
            </Link>
          }
        >
          <p>
            {t(
              "Only administrators can change models, credentials and app-wide settings. Your own coaching approach lives in Settings.",
            )}
          </p>
          <p>
            <Link href="/settings#coach">{t("Open my coach settings")}</Link>
          </p>
        </EmptyState>
      </div>
    </main>
  );
}
