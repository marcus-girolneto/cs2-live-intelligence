"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { WelcomeCredits } from "@/features/billing";
import { useI18n } from "@/shared/i18n";
import { useLocalStorage } from "@/shared/hooks";
import { Close, Menu } from "@/shared/icons";
import type { Account } from "@/shared/session";
import { Brand } from "./Brand";
import { Sidebar } from "./Sidebar";
import { SiteFooter } from "./SiteFooter";

/** Signed-in layout: collapsible sidebar on desktop, top bar + drawer on mobile. */
export function AppShell({
  account,
  children,
}: {
  account: Account;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const path = usePathname();
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useLocalStorage<boolean>(
    "fragmind.sidebar.collapsed",
    false,
    (raw) => (raw === "true" ? true : raw === "false" ? false : null),
  );
  useEffect(() => setDrawer(false), [path]);
  useEffect(() => {
    document.body.classList.toggle("no-scroll", drawer);
    return () => document.body.classList.remove("no-scroll");
  }, [drawer]);
  return (
    <div className={`shell app-shell ${collapsed ? "side-collapsed" : ""}`}>
      <a className="skip-link" href="#main">
        {t("Skip to content")}
      </a>
      <Sidebar
        account={account}
        path={path}
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
      />
      <header className="mobilebar">
        <Brand />
        <button
          type="button"
          className="icon-btn nav-toggle"
          aria-expanded={drawer}
          aria-controls="mobile-nav"
          aria-label={drawer ? t("Close menu") : t("Open menu")}
          onClick={() => setDrawer((o) => !o)}
        >
          {drawer ? <Close /> : <Menu />}
        </button>
      </header>
      {drawer && (
        <div className="drawer-scrim" onClick={() => setDrawer(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <Sidebar
              id="mobile-nav"
              account={account}
              path={path}
              collapsed={false}
            />
          </div>
        </div>
      )}
      <div className="shell-body">
        <div id="main" className="main">
          {children}
        </div>
        <SiteFooter />
      </div>
      <WelcomeCredits />
    </div>
  );
}
