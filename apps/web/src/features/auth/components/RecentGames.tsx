"use client";
import { finite, formatNumber, safeImage } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { Gamepad } from "@/shared/icons";
import { SteamProfile } from "@/shared/session";
type Game = NonNullable<SteamProfile["recentGames"]>[number];

/** Recently played Steam games (icon, name, hours in the last two weeks). */
export function RecentGames({ games }: { games: Game[] }) {
  const { t, locale } = useI18n();
  const num = (v: unknown, d = 0) => formatNumber(v, d, locale);
  return (
    <div className="recent-games">
      <span className="recent-games-title">
        <Gamepad size={16} /> {t("Recently played")}
      </span>
      <ul>
        {games.map((g) => {
          const icon = safeImage(g.iconUrl);
          return (
            <li key={g.appId}>
              {icon ? (
                <img
                  src={icon}
                  alt=""
                  width={32}
                  height={32}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="game-fallback" aria-hidden>
                  <Gamepad size={16} />
                </span>
              )}
              <span className="game-name">{g.name}</span>
              {finite(g.playtime2WeeksHours) !== null && (
                <span className="game-hours">
                  {t("{h} h", { h: num(g.playtime2WeeksHours, 1)! })}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
