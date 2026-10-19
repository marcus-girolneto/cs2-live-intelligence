// Original icon set drawn for this app in a CS2-inspired tactical style (no third-party assets).
import type { ReactNode } from "react";

export type IconProps = { size?: number; className?: string; title?: string };

const base = (size = 22, title?: string) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...(title ? { role: "img", "aria-label": title } : { "aria-hidden": true }),
});
export const icon =
  (body: ReactNode) =>
  ({ size, className, title }: IconProps) => (
    <svg {...base(size, title)} className={className}>
      {title && <title>{title}</title>}
      {body}
    </svg>
  );
