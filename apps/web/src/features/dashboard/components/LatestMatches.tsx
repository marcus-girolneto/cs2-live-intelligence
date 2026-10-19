"use client";
import Link from "next/link";
import { MatchRow, type MatchSummary, SampleImport } from "@/features/matches";
import type { MatchDto } from "@/shared/api-types";
import { useI18n } from "@/shared/i18n";
import { ArrowRight, Crosshair, Upload } from "@/shared/icons";
import { EmptyState, Panel, Skeleton } from "@/shared/ui";
/** Latest five matches (skeleton while loading, sample import when empty). */
export function LatestMatches({
  matches,
  latest,
  summaries,
}: {
  matches: MatchDto[] | null;
  latest: MatchDto[];
  summaries: Map<string, MatchSummary>;
}) {
  const { t } = useI18n();
  return (
    <Panel
      className="dash-matches"
      icon={<Crosshair size={20} />}
      title={t("Latest matches")}
      actions={
        matches && matches.length > 0 ? (
          <Link className="btn btn-ghost btn-sm" href="/history">
            {t("All matches")} <ArrowRight size={16} />
          </Link>
        ) : undefined
      }
    >
      {matches === null ? (
        <div className="match-list">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={64} />
          ))}
        </div>
      ) : latest.length === 0 ? (
        <EmptyState
          compact
          icon={<Crosshair size={26} />}
          title={t("No demos uploaded yet")}
          actions={
            <Link className="btn btn-primary" href="/upload">
              <Upload size={18} /> {t("Upload demo")}
            </Link>
          }
        >
          <SampleImport />
        </EmptyState>
      ) : (
        <div className="match-list stagger">
          {latest.map((m) => (
            <MatchRow
              key={m.id}
              match={m}
              summary={summaries.get(m.analysisId ?? m.id)}
              href={`/history?match=${encodeURIComponent(m.id)}`}
            />
          ))}
        </div>
      )}
    </Panel>
  );
}
