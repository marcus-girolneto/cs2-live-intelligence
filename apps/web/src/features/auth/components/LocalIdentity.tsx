"use client";
import { useI18n } from "@/shared/i18n";
import { Avatar } from "@/shared/ui";
import { SteamSignIn } from "./SteamSignIn";
/** Identity card of the local demo account (no Steam profile yet). */
export function LocalIdentity({ name }: { name: string }) {
  const { t } = useI18n();
  return (
    <section className="identity identity-local">
      <div className="identity-banner" aria-hidden />
      <div className="identity-main">
        <Avatar size={88} fallback={name} ring={false} />
        <div className="identity-text">
          <span className="eyebrow">{t("Local account")}</span>
          <h2 className="identity-name">{name}</h2>
          <p className="identity-bio">
            {t(
              "You are using the local demo account. Sign in with Steam to use your own identity; your demos will then highlight you automatically.",
            )}
          </p>
          <SteamSignIn size="md" />
        </div>
      </div>
    </section>
  );
}
