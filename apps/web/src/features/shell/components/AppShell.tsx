"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSignOut } from "@/features/auth";
import { PlanBadge, useUsage } from "@/features/billing";
import { useI18n } from "@/shared/i18n";
import {
  Card,
  Close,
  Gear,
  Logout,
  Menu,
  Server,
  ChevronDown,
} from "@/shared/icons";
import { type Account, displayName } from "@/shared/session";
import { Avatar } from "@/shared/ui";
import { ADMIN, LINKS } from "../model/links";
import { Brand } from "./Brand";
import { LangToggle } from "./LangToggle";
import { SiteFooter } from "./SiteFooter";
export function AppShell({
  account,
  children,
}: {
  account: Account;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { busy, error, signOut } = useSignOut();
  const { plan } = useUsage();
  const links = account.role === "admin" ? [...LINKS, ADMIN] : LINKS;
  const name = displayName(account, t("Local account"));
  const active = (href: string) =>
    href === "/"
      ? path === "/"
      : path === href ||
        path.startsWith(`${href}/`) ||
        (href === "/history" && path === "/demo");
  useEffect(() => {
    setOpen(false);
    setMenu(false);
  }, [path]);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [menu]);
  useEffect(() => {
    document.body.classList.toggle("no-scroll", open);
    return () => document.body.classList.remove("no-scroll");
  }, [open]);
  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        {t("Skip to content")}
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <Brand />
          <nav className="nav" aria-label={t("Main navigation")}>
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`nav-link ${href === "/coach" ? "nav-star" : ""}`}
                aria-current={active(href) ? "page" : undefined}
              >
                <Icon size={18} />
                <span>{t(label)}</span>
              </Link>
            ))}
          </nav>
          <div className="topbar-right">
            <LangToggle />
            <div className="user-menu" ref={menuRef}>
              <button
                type="button"
                className="user-chip"
                aria-expanded={menu}
                aria-haspopup="menu"
                onClick={() => setMenu((m) => !m)}
              >
                <Avatar profile={account.profile} size={32} fallback={name} />
                <span className="user-chip-name">{name}</span>
                <ChevronDown size={16} />
              </button>
              {menu && (
                <div className="user-pop" role="menu">
                  <div className="user-pop-head">
                    <Avatar
                      profile={account.profile}
                      size={44}
                      fallback={name}
                    />
                    <div>
                      <strong>{name}</strong>
                      <small>
                        {account.steamId
                          ? t("Signed in with Steam")
                          : t("Local account")}
                        {account.role === "admin" ? ` · ${t("Admin")}` : ""}
                      </small>
                      <PlanBadge plan={plan} />
                    </div>
                  </div>
                  <Link role="menuitem" href="/billing">
                    <Card size={18} /> {t("Plan & billing")}
                  </Link>
                  <Link role="menuitem" href="/settings">
                    <Gear size={18} /> {t("Settings")}
                  </Link>
                  {account.role === "admin" && (
                    <Link role="menuitem" href="/admin">
                      <Server size={18} /> {t("Admin")}
                    </Link>
                  )}
                  <button
                    role="menuitem"
                    type="button"
                    disabled={busy}
                    onClick={() => void signOut()}
                  >
                    <Logout size={18} />{" "}
                    {busy ? t("Signing out…") : t("Sign out")}
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              className="icon-btn nav-toggle"
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? t("Close menu") : t("Open menu")}
              onClick={() => setOpen((o) => !o)}
            >
              {open ? <Close /> : <Menu />}
            </button>
          </div>
        </div>
        {error && (
          <p role="alert" className="topbar-error">
            {error}
          </p>
        )}
      </header>
      <div
        id="mobile-nav"
        className={`drawer ${open ? "open" : ""}`}
        hidden={!open}
      >
        <div className="drawer-user">
          <Avatar profile={account.profile} size={48} fallback={name} />
          <div>
            <strong>{name}</strong>
            <small>
              {account.steamId ? t("Signed in with Steam") : t("Local account")}
            </small>
          </div>
        </div>
        <nav aria-label={t("Main navigation")}>
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={active(href) ? "page" : undefined}
            >
              <Icon size={20} />
              <span>{t(label)}</span>
            </Link>
          ))}
        </nav>
        <div className="drawer-foot">
          <LangToggle />
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy}
            onClick={() => void signOut()}
          >
            <Logout size={18} /> {busy ? t("Signing out…") : t("Sign out")}
          </button>
        </div>
      </div>
      <div id="main" className="main">
        {children}
      </div>
      <SiteFooter />
    </div>
  );
}
