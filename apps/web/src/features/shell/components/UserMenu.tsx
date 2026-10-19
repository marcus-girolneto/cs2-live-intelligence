"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSignOut } from "@/features/auth";
import { PlanBadge, useUsage } from "@/features/billing";
import { useI18n } from "@/shared/i18n";
import { Card, ChevronDown, Gear, Logout, Server } from "@/shared/icons";
import { type Account, displayName } from "@/shared/session";
import { Avatar } from "@/shared/ui";

/** Account card at the bottom of the sidebar; opens a menu upwards. */
export function UserMenu({
  account,
  collapsed,
}: {
  account: Account;
  collapsed: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { busy, error, signOut } = useSignOut();
  const { plan } = useUsage();
  const name = displayName(account, t("Local account"));
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div className="user-menu" ref={ref}>
      <button
        type="button"
        className="user-chip"
        aria-expanded={open}
        aria-haspopup="menu"
        title={collapsed ? name : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <Avatar profile={account.profile} size={34} fallback={name} />
        <span className="user-chip-text">
          <span className="user-chip-name">{name}</span>
          <PlanBadge plan={plan} />
        </span>
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className="user-pop" role="menu">
          <div className="user-pop-head">
            <Avatar profile={account.profile} size={44} fallback={name} />
            <div>
              <strong>{name}</strong>
              <small>
                {account.steamId
                  ? t("Signed in with Steam")
                  : t("Local account")}
                {account.role === "admin" ? ` · ${t("Admin")}` : ""}
              </small>
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
            <Logout size={18} /> {busy ? t("Signing out…") : t("Sign out")}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="side-error">
          {error}
        </p>
      )}
    </div>
  );
}
