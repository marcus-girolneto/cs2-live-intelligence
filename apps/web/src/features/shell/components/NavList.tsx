"use client";
import Link from "next/link";
import { useI18n } from "@/shared/i18n";
import { isActive, type NavLink } from "../model/links";

/** One group of sidebar links; labels become tooltips when the sidebar is collapsed. */
export function NavList({
  title,
  links,
  path,
  collapsed,
}: {
  title?: string;
  links: readonly NavLink[];
  path: string;
  collapsed: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="side-group">
      {title && <span className="side-group-title">{t(title)}</span>}
      {links.map(({ href, label, icon: Icon, star }) => (
        <Link
          key={href}
          href={href}
          className={`side-link ${star ? "side-star" : ""}`}
          aria-current={isActive(path, href) ? "page" : undefined}
          title={collapsed ? t(label) : undefined}
        >
          <Icon size={20} />
          <span>{t(label)}</span>
          {star && <i className="side-dot" aria-hidden="true" />}
        </Link>
      ))}
    </div>
  );
}
