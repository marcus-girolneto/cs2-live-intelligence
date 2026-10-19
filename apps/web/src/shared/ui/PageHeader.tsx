import type { ReactNode } from "react";

/** Page heading block shared by every signed-in page. */
export function PageHeader({
  eyebrow,
  title,
  lead,
  actions,
  icon,
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-header-text">
        {eyebrow && (
          <span className="eyebrow">
            {icon}
            {eyebrow}
          </span>
        )}
        <h1>{title}</h1>
        {lead && <p className="lead">{lead}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}
