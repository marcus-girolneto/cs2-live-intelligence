import {
  Brain,
  Chart,
  Crosshair,
  Dumbbell,
  Medal,
  Gear,
  Monitor,
  Radar,
  Server,
  Star,
  Upload,
} from "@/shared/icons";

export type NavLink = {
  href: string;
  label: string;
  icon: typeof Radar;
  star?: boolean;
  /** Small tag next to the label (e.g. "Pro"). */
  badge?: string;
};
export type NavGroup = { label: string; links: readonly NavLink[] };

/** Main navigation, grouped: what you look at, what you do, and account settings. */
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: "Analyze",
    links: [
      { href: "/", label: "Dashboard", icon: Radar },
      { href: "/coach", label: "AI Coach", icon: Brain, star: true },
      {
        href: "/coach/personal",
        label: "Personal Coach",
        icon: Star,
        star: true,
        badge: "Pro",
      },
      { href: "/history", label: "Matches", icon: Crosshair },
      { href: "/training", label: "Train", icon: Dumbbell },
      { href: "/progress", label: "Progress", icon: Chart },
      { href: "/reports", label: "Reports", icon: Medal, badge: "Pro" },
    ],
  },
  {
    label: "Game",
    links: [
      { href: "/upload", label: "Upload", icon: Upload },
      { href: "/live", label: "Second screen", icon: Monitor },
    ],
  },
];
export const SETTINGS: NavLink = {
  href: "/settings",
  label: "Settings",
  icon: Gear,
};
export const ADMIN: NavLink = { href: "/admin", label: "Admin", icon: Server };

/** Whether `href` is the current section (the match page counts as Matches). */
export function isActive(path: string, href: string): boolean {
  if (href === "/") return path === "/";
  // Personal Coach has its own entry under /coach.
  if (href === "/coach" && path.startsWith("/coach/personal")) return false;
  return (
    path === href ||
    path.startsWith(`${href}/`) ||
    (href === "/history" && path === "/demo")
  );
}
