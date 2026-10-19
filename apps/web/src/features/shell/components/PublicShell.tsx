import type { ReactNode } from "react";
import { Brand } from "./Brand";
import { LangToggle } from "./LangToggle";
import { SiteFooter } from "./SiteFooter";
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Brand />
          <div className="topbar-right">
            <LangToggle />
          </div>
        </div>
      </header>
      <div className="main">{children}</div>
      <SiteFooter />
    </div>
  );
}
