import type { ReactNode } from "react";
import { Brand } from "./Brand";
import { LanguageSelect } from "./LanguageSelect";
import { SiteFooter } from "./SiteFooter";
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Brand />
          <div className="topbar-right">
            <LanguageSelect />
          </div>
        </div>
      </header>
      <div className="main">{children}</div>
      <SiteFooter />
    </div>
  );
}
