import type { ReactNode } from "react";
import { Alert as AlertIcon, Check, Info } from "../icons";

export function Callout({
  tone = "info",
  title,
  children,
  role,
  className = "",
}: {
  tone?: "info" | "error" | "success" | "warn";
  title?: ReactNode;
  children?: ReactNode;
  role?: "alert" | "status";
  className?: string;
}) {
  const Icon = tone === "success" ? Check : tone === "info" ? Info : AlertIcon;
  return (
    <div className={`callout tone-${tone} ${className}`} role={role}>
      <Icon size={18} />
      <div>
        {title && <strong className="callout-title">{title}</strong>}
        {children}
      </div>
    </div>
  );
}
