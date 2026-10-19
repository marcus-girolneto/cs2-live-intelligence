"use client";
import type { MatchDto } from "@/shared/api-types";
import { useMemo, useState } from "react";
import { useI18n } from "@/shared/i18n";
import { Panel } from "@/shared/ui";
import {
  filterMatches,
  type AutoReview,
  type MatchFilter,
  type Ownership,
  type OwnershipKind,
} from "../model/ownership";
import type { MatchSummary } from "../model/status";
import { MatchFilters } from "./MatchFilters";
import { MatchRow } from "./MatchRow";
import { PlayerPickDialog, type PickedPlayer } from "./PlayerPickDialog";
import { RowMenu } from "./RowMenu";

/** /history list: mine/external tabs, filters, rows with ownership actions. */
export function MatchListPanel({
  matches,
  summaries,
  owners,
  auto,
  selectedId,
  onSelect,
  mark,
}: {
  matches: MatchDto[];
  summaries: Map<string, MatchSummary>;
  owners: Map<string, Ownership>;
  auto: Map<string, AutoReview>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  mark: (id: string, kind: OwnershipKind, p?: PickedPlayer) => Promise<void>;
}) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<MatchFilter>({
    tab: "all",
    map: null,
    period: "all",
  });
  const [showAll, setShowAll] = useState(false);
  const [picking, setPicking] = useState<MatchDto | null>(null);
  const [now] = useState(() => Date.now());
  const { list, counts } = useMemo(
    () => filterMatches(matches, owners, summaries, filter, now),
    [matches, owners, summaries, filter, now],
  );
  const maps = useMemo(
    () =>
      [
        ...new Set(
          [...summaries.values()]
            .map((s) => s.map)
            .filter((m): m is string => !!m),
        ),
      ].sort(),
    [summaries],
  );
  const visible = showAll ? list : list.slice(0, 6);
  return (
    <Panel className="flat matches-panel">
      <MatchFilters
        value={filter}
        onChange={(f) => {
          setFilter(f);
          setShowAll(false);
        }}
        counts={counts}
        maps={maps}
      />
      {list.length === 0 ? (
        <p className="muted">{t("No matches with these filters.")}</p>
      ) : (
        <div className="match-list stagger">
          {visible.map((m) => (
            <MatchRow
              key={m.id}
              match={m}
              summary={summaries.get(m.analysisId ?? m.id)}
              selected={selectedId === m.id}
              onClick={() => onSelect(m.id)}
              owner={owners.get(m.id)}
              auto={auto.get(m.id)}
              menu={
                m.status === "complete" ? (
                  <RowMenu
                    label={m.filename || m.id}
                    onMine={() => setPicking(m)}
                    onExternal={() => void mark(m.id, "external")}
                  />
                ) : undefined
              }
            />
          ))}
        </div>
      )}
      {list.length > 6 && (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setShowAll((s) => !s)}
        >
          {showAll
            ? t("Show fewer")
            : t("Show all {n} matches", { n: list.length })}
        </button>
      )}
      {picking && (
        <PlayerPickDialog
          analysisId={picking.analysisId ?? null}
          onPick={(p) => mark(picking.id, "mine", p)}
          onExternal={() => mark(picking.id, "external")}
          onClose={() => setPicking(null)}
        />
      )}
    </Panel>
  );
}
