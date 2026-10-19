import type { ReactNode } from "react";

export function Panel({
  title,
  icon,
  actions,
  children,
  className = "",
  sub,
  id,
  as: Tag = "section",
}: {
  title?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  sub?: ReactNode;
  id?: string;
  as?: "section" | "div" | "article" | "aside";
}) {
  return (
    <Tag className={`panel ${className}`} id={id}>
      {(title || actions) && (
        <header className="panel-head">
          <div className="panel-title">
            {icon && <span className="panel-icon">{icon}</span>}
            <div>
              {title && <h2>{title}</h2>}
              {sub && <p className="panel-sub">{sub}</p>}
            </div>
          </div>
          {actions && <div className="panel-actions">{actions}</div>}
        </header>
      )}
      {children}
    </Tag>
  );
}
