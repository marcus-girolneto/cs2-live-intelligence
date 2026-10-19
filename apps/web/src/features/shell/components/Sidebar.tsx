"use client";
import { useI18n } from "@/shared/i18n";
import { ChevronDown } from "@/shared/icons";
import type { Account } from "@/shared/session";
import { ADMIN, NAV_GROUPS, SETTINGS } from "../model/links";
import { Brand } from "./Brand";
import { LangToggle } from "./LangToggle";
import { NavList } from "./NavList";
import { UserMenu } from "./UserMenu";

/** Desktop sidebar (also the mobile drawer): brand, grouped navigation, account. */
export function Sidebar({
  account,
  path,
  collapsed,
  onToggle,
  id,
}: {
  account: Account;
  path: string;
  collapsed: boolean;
  onToggle?: () => void;
  id?: string;
}) {
  const { t } = useI18n();
  const bottom = account.role === "admin" ? [SETTINGS, ADMIN] : [SETTINGS];
  return (
    <aside id={id} className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="side-head">
        <Brand />
        {onToggle && (
          <button
            type="button"
            className="side-collapse"
            aria-label={collapsed ? t("Expand menu") : t("Collapse menu")}
            aria-expanded={!collapsed}
            onClick={onToggle}
          >
            <ChevronDown size={18} />
          </button>
        )}
      </div>
      <nav className="side-nav" aria-label={t("Main navigation")}>
        {NAV_GROUPS.map((g) => (
          <NavList
            key={g.label}
            title={g.label}
            links={g.links}
            path={path}
            collapsed={collapsed}
          />
        ))}
        <div className="side-spacer" />
        <NavList links={bottom} path={path} collapsed={collapsed} />
      </nav>
      <div className="side-foot">
        <LangToggle />
        <UserMenu account={account} collapsed={collapsed} />
      </div>
    </aside>
  );
}
