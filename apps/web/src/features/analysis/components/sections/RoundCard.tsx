"use client";
import type { DemoEvent } from "@cs2/contracts";
import { placeName } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { Bomb, DefuseKit } from "@/shared/icons";
import type { KillRow, PlayerRound } from "../../model/types";
import { KillFeed } from "../KillFeed";
export function RoundCard({
  round,
  winner,
  row,
  feed,
  bombs,
  names,
  steamId,
}: {
  round: number;
  winner?: "CT" | "T" | undefined;
  row: PlayerRound | undefined;
  feed: KillRow[];
  bombs: Extract<DemoEvent, { type: "bomb" }>[];
  names: Map<string, string>;
  steamId: string;
}) {
  const { t, locale } = useI18n();
  const buy: Record<string, string> = {
    pistol: "Pistol",
    eco: "Eco",
    force: "Force",
    full: "Full buy",
  };
  const tags = row
    ? [
        row.kills > 0
          ? { text: t("{k} kill(s)", { k: row.kills }), tone: "good" }
          : null,
        row.damage > 0
          ? { text: t("{d} damage", { d: row.damage }), tone: "" }
          : { text: t("No damage"), tone: "bad" },
        row.opening === "kill"
          ? { text: t("Opening kill"), tone: "good" }
          : row.opening === "death"
            ? { text: t("Died first"), tone: "bad" }
            : null,
        row.died
          ? {
              text: [
                row.traded ? t("Died, traded") : t("Died, not traded"),
                row.deathPlace ? placeName(row.deathPlace) : null,
                row.deathTime !== undefined
                  ? `${Math.floor(row.deathTime / 60)}:${String(Math.floor(row.deathTime % 60)).padStart(2, "0")}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · "),
              tone: row.traded ? "" : "bad",
            }
          : { text: t("Survived"), tone: "good" },
        row.clutchVs
          ? { text: t("Clutch 1v{n}", { n: row.clutchVs }), tone: "accent" }
          : null,
        row.killedBy
          ? {
              text: t("Killed by {name}", {
                name: names.get(row.killedBy) ?? row.killedBy,
              }),
              tone: "",
            }
          : null,
        row.shots !== undefined && row.shots > 0
          ? {
              text: t("{h}/{s} shots hit", { h: row.hits ?? 0, s: row.shots }),
              tone: "",
            }
          : null,
      ].filter((x): x is { text: string; tone: string } => !!x)
    : [];
  return (
    <article
      className={`round-card ${row?.won === true ? "won" : row?.won === false ? "lost" : ""}`}
      id={`round-${round}`}
    >
      <header>
        <strong>{t("Round {n}", { n: round })}</strong>
        {(row?.side || row?.buyType) && (
          <span className="rc-context">
            (
            {[
              row?.side,
              row?.buyType
                ? `${t(buy[row.buyType]!)}${
                    row.equipmentValue !== undefined
                      ? ` · $${row.equipmentValue.toLocaleString(locale)}`
                      : ""
                  }`
                : null,
            ]
              .filter(Boolean)
              .join(", ")}
            )
          </span>
        )}
        <span className="rc-spacer" />
        {row?.won !== undefined && (
          <span className={`rc-result ${row.won ? "won" : "lost"}`}>
            {row.won ? t("Won") : t("Lost")}
          </span>
        )}
        {winner && row?.won === undefined && (
          <span className={`chip ${winner.toLowerCase()}`}>
            {t("{side} won", { side: winner })}
          </span>
        )}
      </header>
      {tags.length > 0 && (
        <div className="chip-row">
          {tags.map((tag) => (
            <span key={tag.text} className={`chip ${tag.tone}`}>
              {tag.text}
            </span>
          ))}
        </div>
      )}
      {feed.length > 0 && (
        <KillFeed
          rows={feed}
          names={names}
          highlight={steamId}
          world={t("World")}
        />
      )}
      {bombs.length > 0 && (
        <ul className="bomb-feed">
          {bombs.map((b) => (
            <li key={b.id} className={`bomb-${b.action}`}>
              {b.action === "defuse" ? (
                <DefuseKit size={15} />
              ) : (
                <Bomb size={15} />
              )}
              {b.action === "plant"
                ? t("Bomb planted{site}", {
                    site: b.site ? ` · ${b.site}` : "",
                  })
                : b.action === "defuse"
                  ? t("Bomb defused")
                  : t("Bomb exploded")}
              {b.playerId && names.get(b.playerId) && (
                <span className="muted"> · {names.get(b.playerId)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
