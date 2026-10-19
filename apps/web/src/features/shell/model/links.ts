import {
  Brain,
  Chart,
  Crosshair,
  Gear,
  Monitor,
  Radar,
  Server,
  Upload,
} from "@/shared/icons";
export const LINKS = [
  { href: "/", label: "Dashboard", icon: Radar },
  { href: "/coach", label: "AI Coach", icon: Brain },
  { href: "/history", label: "Matches", icon: Crosshair },
  { href: "/progress", label: "Progress", icon: Chart },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/live", label: "Second screen", icon: Monitor },
  { href: "/settings", label: "Settings", icon: Gear },
] as const;
export const ADMIN = { href: "/admin", label: "Admin", icon: Server } as const;
