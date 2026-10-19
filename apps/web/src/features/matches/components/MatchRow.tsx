"use client";
import type { MatchDto } from "@/shared/api-types";
import Link from "next/link";
import { formatDate, formatNumber, mapName } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { ChevronRight } from "@/shared/icons";
import { MapTile } from "@/shared/ui";
import type { ReactNode } from "react";
import {
  autoReviewLabel,
  type AutoReview,
  type Ownership,
} from "../model/ownership";
import type { MatchSummary } from "../model/status";
import { StatusPill } from "./StatusPill";
export function MatchRow({
  match,
  summary,
  href,
  onClick,
  selected,
  owner,
  auto,
  menu,
}: {
  match: MatchDto;
  summary?: MatchSummary;
  href?: string;
  onClick?: () => void;
  selected?: boolean;
  /** Whether you played in this demo (unknown when absent). */
  owner?: Ownership | undefined;
  auto?: AutoReview | undefined;
  /** Row actions (rendered next to the row, never inside the button). */
  menu?: ReactNode;
}) {
  const { t, locale } = useI18n();
  const map = mapName(summary?.map);
  const adr = formatNumber(summary?.adr, 1, locale);
  const kd =
    summary?.kills != null && summary?.deaths != null
      ? `${formatNumber(summary.kills, 0, locale)}–${formatNumber(summary.deaths, 0, locale)}`
      : null;
  const external = owner?.ownership === "external";
  const mine = owner?.ownership === "mine" && !!owner.playerName;
  const autoTag = external ? null : autoReviewLabel(auto);
  const body = (
    <>
      <MapTile map={summary?.map} />
      <span className="match-main">
        <strong>{map ?? (match.filename || t("Unnamed demo"))}</strong>
        <small>
          {[map ? match.filename : null, formatDate(match.createdAt, locale)]
            .filter(Boolean)
            .join(" · ")}
        </small>
        {(external || mine || autoTag) && (
          <span className="match-tags">
            {mine && (
              <span className="m-tag mine">
                {t("You: {name}", { name: owner!.playerName! })}
              </span>
            )}
            {external && (
              <span className="m-tag ext">{t("You're not in this match")}</span>
            )}
            {autoTag && (
              <span className={`m-tag ${autoTag.tone}`}>{t(autoTag.text)}</span>
            )}
          </span>
        )}
      </span>
      {!external && (adr || kd) && (
        <span className="match-nums">
          {kd && (
            <span>
              <b>{kd}</b>
              <small>{t("K–D")}</small>
            </span>
          )}
          {adr && (
            <span>
              <b>{adr}</b>
              <small>ADR</small>
            </span>
          )}
        </span>
      )}
      <StatusPill status={match.status} />
      <ChevronRight size={18} className="match-arrow" />
    </>
  );
  const row = href ? (
    <Link href={href} className={`match-row ${external ? "external" : ""}`}>
      {body}
    </Link>
  ) : (
    <button
      type="button"
      className={`match-row ${external ? "external" : ""}`}
      onClick={onClick}
      aria-pressed={selected}
    >
      {body}
    </button>
  );
  return menu ? (
    <div className="match-row-wrap">
      {row}
      {menu}
    </div>
  ) : (
    row
  );
}
