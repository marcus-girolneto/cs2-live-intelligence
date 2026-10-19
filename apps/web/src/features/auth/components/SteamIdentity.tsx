"use client";
import { useState } from "react";
import {
  finite,
  formatDate,
  formatNumber,
  text,
  flagEmoji,
  hasBans,
  presence,
  safeLink,
  yearsSince,
} from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import {
  Clock,
  External,
  Medal,
  Refresh,
  ShieldAlert,
  ShieldCheck,
  Users,
  Hourglass,
} from "@/shared/icons";
import { type Account, displayName } from "@/shared/session";
import { CrosshairLoader, Avatar, CountUp } from "@/shared/ui";
import { useRefreshProfile } from "../hooks/useRefreshProfile";
import { LocalIdentity } from "./LocalIdentity";
import { RecentGames } from "./RecentGames";
const PRESENCE: Record<string, string> = {
  online: "Online",
  ingame: "In game",
  away: "Away",
  offline: "Offline",
};

/** Player identity from Steam: avatar, presence, name, bio, CS2 hours, bans, recent games. */
export function SteamIdentity({
  account,
  compact,
}: {
  account: Account;
  compact?: boolean;
}) {
  const { t, locale } = useI18n();
  const { busy, note, refreshProfile } = useRefreshProfile();
  const [expanded, setExpanded] = useState(false);
  const p = account.profile;
  const name = displayName(account, t("Local account"));
  const state = presence(p);
  const flag = flagEmoji(p?.countryCode);
  const level = finite(p?.steamLevel);
  const hours = finite(p?.cs2?.playtimeHours);
  const recent = finite(p?.cs2?.playtime2WeeksHours);
  const years = yearsSince(p?.steamMemberSince);
  const bio = text(p?.summary);
  const link = safeLink(p?.profileUrl);
  const vac = finite(p?.bans?.vacBans) ?? 0;
  const gameBans = finite(p?.bans?.gameBans) ?? 0;
  const days = finite(p?.bans?.daysSinceLastBan);
  const games = (p?.recentGames ?? []).filter((g) => text(g.name)).slice(0, 4);
  const num = (v: unknown, d = 0) => formatNumber(v, d, locale);

  if (!account.steamId) return <LocalIdentity name={name} />;

  const facts = [
    hours !== null && {
      icon: <Hourglass size={18} />,
      label: t("CS2 hours"),
      value: <CountUp value={hours} />,
      sub:
        recent !== null && recent > 0
          ? t("{h} h last 2 weeks", { h: num(recent, 1)! })
          : undefined,
    },
    years !== null && {
      icon: <Clock size={18} />,
      label: t("On Steam"),
      value: years < 1 ? t("< 1 year") : t("{n} years", { n: years }),
      sub: formatDate(p?.steamMemberSince, locale)?.split(/[ ,]/)[0],
    },
    finite(p?.friendsCount) !== null && {
      icon: <Users size={18} />,
      label: t("Friends"),
      value: <CountUp value={p?.friendsCount} />,
    },
    finite(p?.badgesCount) !== null && {
      icon: <Medal size={18} />,
      label: t("Badges"),
      value: <CountUp value={p?.badgesCount} />,
    },
    finite(p?.groupsCount) !== null && {
      icon: <Users size={18} />,
      label: t("Groups"),
      value: <CountUp value={p?.groupsCount} />,
    },
  ].filter(Boolean) as {
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
    sub?: string;
  }[];

  return (
    <section className={`identity ${compact ? "compact" : ""}`}>
      <div className="identity-banner" aria-hidden />
      <div className="identity-main">
        <div className="identity-avatar">
          <Avatar profile={p} size={compact ? 72 : 104} fallback={name} />
          {level !== null && (
            <span className="steam-level" title={t("Steam level")}>
              {level}
            </span>
          )}
        </div>
        <div className="identity-text">
          <div className={`presence presence-${state}`}>
            <i aria-hidden />
            {state === "ingame" && text(p?.currentGame)
              ? t("Playing {game}", { game: text(p?.currentGame)! })
              : t(PRESENCE[state]!)}
            {state === "offline" && formatDate(p?.lastLogoff, locale) && (
              <span className="muted">
                {" · "}
                {t("last seen {date}", {
                  date: formatDate(p?.lastLogoff, locale)!,
                })}
              </span>
            )}
          </div>
          <h2 className="identity-name">{name}</h2>
          <p className="identity-meta">
            {text(p?.realName) && <span>{text(p?.realName)}</span>}
            {(flag || text(p?.location)) && (
              <span>
                {flag && (
                  <span className="flag" role="img" aria-label={p?.countryCode}>
                    {flag}
                  </span>
                )}{" "}
                {text(p?.location) ?? p?.countryCode}
              </span>
            )}
            {p?.visibility && p.visibility !== "public" && (
              <span className="chip">{t("Private profile")}</span>
            )}
          </p>
          {bio && (
            <div className={`identity-bio ${expanded ? "open" : ""}`}>
              <p>{bio}</p>
              {bio.length > 180 && (
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => setExpanded((x) => !x)}
                >
                  {expanded ? t("Show less") : t("Read more")}
                </button>
              )}
            </div>
          )}
          <div className="identity-chips">
            {p?.bans ? (
              hasBans(p) ? (
                <span className="chip bad">
                  <ShieldAlert size={14} />
                  {[
                    vac > 0 ? t("{n} VAC ban(s)", { n: vac }) : null,
                    gameBans > 0 ? t("{n} game ban(s)", { n: gameBans }) : null,
                    p.bans.communityBanned ? t("Community ban") : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  {days !== null && ` · ${t("{n} days ago", { n: days })}`}
                </span>
              ) : (
                <span className="chip good">
                  <ShieldCheck size={14} /> {t("No VAC or game bans")}
                </span>
              )
            ) : null}
            {account.role === "admin" && (
              <span className="chip accent">{t("Admin")}</span>
            )}
            <span className="chip mono" title="SteamID64">
              ID {account.steamId}
            </span>
          </div>
        </div>
        <div className="identity-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void refreshProfile()}
            disabled={busy}
          >
            {busy ? <CrosshairLoader size={16} /> : <Refresh size={16} />}
            {t("Refresh profile")}
          </button>
          {link && (
            <a
              className="btn btn-ghost btn-sm"
              href={link}
              target="_blank"
              rel="noreferrer noopener"
            >
              <External size={16} /> {t("Steam profile")}
            </a>
          )}
          {note && (
            <span className="identity-note" role="status">
              {note}
            </span>
          )}
        </div>
      </div>
      {!p && (
        <p className="identity-foot muted small">
          {t("Your Steam profile details are not available yet.")}
        </p>
      )}
      {(facts.length > 0 || games.length > 0) && (
        <div className="identity-foot">
          {facts.length > 0 && (
            <dl className="identity-facts">
              {facts.map((f) => (
                <div key={f.label}>
                  <dt>
                    {f.icon}
                    {f.label}
                  </dt>
                  <dd>{f.value}</dd>
                  {f.sub && <small>{f.sub}</small>}
                </div>
              ))}
            </dl>
          )}
          {games.length > 0 && <RecentGames games={games} />}
        </div>
      )}
    </section>
  );
}
