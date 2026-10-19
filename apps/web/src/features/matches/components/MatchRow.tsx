"use client";
import type { MatchDto } from "@/shared/api-types";
import Link from "next/link";
import { formatDate, formatNumber, mapName } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { ChevronRight } from "@/shared/icons";
import { MapTile } from "@/shared/ui";
import type { MatchSummary } from "../model/status";
import { StatusPill } from "./StatusPill";
export function MatchRow({
  match,
  summary,
  href,
  onClick,
  selected,
}: {
  match: MatchDto;
  summary?: MatchSummary;
  href?: string;
  onClick?: () => void;
  selected?: boolean;
}) {
  const { t, locale } = useI18n();
  const map = mapName(summary?.map);
  const adr = formatNumber(summary?.adr, 1, locale);
  const kd =
    summary?.kills != null && summary?.deaths != null
      ? `${formatNumber(summary.kills, 0, locale)}–${formatNumber(summary.deaths, 0, locale)}`
      : null;
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
      </span>
      {(adr || kd) && (
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
  return href ? (
    <Link href={href} className="match-row">
      {body}
    </Link>
  ) : (
    <button
      type="button"
      className="match-row"
      onClick={onClick}
      aria-pressed={selected}
    >
      {body}
    </button>
  );
}
