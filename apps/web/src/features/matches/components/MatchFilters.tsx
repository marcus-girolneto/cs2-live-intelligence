"use client";
import { mapName } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import type { MatchFilter, OwnerTab, Period } from "../model/ownership";

const TABS: { id: OwnerTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "mine", label: "My matches" },
  { id: "external", label: "External demos" },
];
const PERIODS: { id: Period; label: string }[] = [
  { id: "all", label: "Any date" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
];

/** Mine / external tabs with counts, plus map and date filters. */
export function MatchFilters({
  value,
  onChange,
  counts,
  maps,
}: {
  value: MatchFilter;
  onChange: (f: MatchFilter) => void;
  counts: Record<OwnerTab, number>;
  maps: string[];
}) {
  const { t } = useI18n();
  return (
    <div className="match-filters">
      <div className="segmented" role="group" aria-label={t("Whose matches")}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-pressed={value.tab === tab.id}
            onClick={() => onChange({ ...value, tab: tab.id })}
          >
            {t(tab.label)} <span className="count">{counts[tab.id]}</span>
          </button>
        ))}
      </div>
      <div className="mf-selects">
        {maps.length > 1 && (
          <select
            aria-label={t("Map")}
            value={value.map ?? ""}
            onChange={(e) =>
              onChange({ ...value, map: e.target.value || null })
            }
          >
            <option value="">{t("All maps")}</option>
            {maps.map((m) => (
              <option key={m} value={m}>
                {mapName(m) ?? m}
              </option>
            ))}
          </select>
        )}
        <select
          aria-label={t("Date")}
          value={value.period}
          onChange={(e) =>
            onChange({ ...value, period: e.target.value as Period })
          }
        >
          {PERIODS.map((p) => (
            <option key={p.id} value={p.id}>
              {t(p.label)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
