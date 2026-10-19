"use client";
import { useMemo, useState } from "react";
import { formatDate } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { ListIcon, Refresh } from "@/shared/icons";
import { Callout, EmptyState, Panel, Skeleton } from "@/shared/ui";
import { useResource } from "../hooks/useResource";
import type { AdminUser, AuditEntry } from "../model/types";
/* ------------------------------------------------------------ audit */
const ACTIONS: Record<string, string> = {
  "ai.provider.create": "Provider added",
  "ai.provider.update": "Provider updated",
  "ai.provider.delete": "Provider deleted",
  "ai.provider.test": "Provider tested",
  "ai.assignments.update": "Assignments changed",
  "settings.update": "App settings changed",
  "user.role": "Role changed",
};
export function AuditPanel({ onForbidden }: { onForbidden: () => void }) {
  const { t, locale } = useI18n();
  const [limit, setLimit] = useState(100);
  const { data, error, loading, reload } = useResource<{
    entries?: AuditEntry[];
  }>(`admin/audit?limit=${limit}`, onForbidden);
  const users = useResource<{ users?: AdminUser[] }>("admin/users", () => {});
  const names = useMemo(
    () =>
      new Map(
        (users.data?.users ?? []).map((u) => [
          u.id,
          u.personaName || u.steamId || u.id,
        ]),
      ),
    [users.data],
  );
  const entries = data?.entries ?? [];
  const compact = (v: unknown) => {
    if (v === null || v === undefined) return "";
    try {
      const s = JSON.stringify(v);
      return s === "{}" ? "" : s.length > 400 ? `${s.slice(0, 400)}…` : s;
    } catch {
      return "";
    }
  };
  return (
    <Panel
      title={t("Audit log")}
      icon={<ListIcon size={20} />}
      sub={t(
        "Every administrative change, newest first. Secrets are never recorded.",
      )}
      actions={
        <>
          <select
            aria-label={t("Entries to show")}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="adm-limit"
          >
            {[50, 100, 250, 500].map((n) => (
              <option key={n} value={n}>
                {t("Last {n}", { n })}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void reload()}
          >
            <Refresh size={16} /> {t("Refresh")}
          </button>
        </>
      }
    >
      {error && (
        <Callout tone="error" role="alert">
          {t(error)}
        </Callout>
      )}
      {loading && !data ? (
        <Skeleton lines={6} />
      ) : entries.length === 0 ? (
        <EmptyState
          compact
          icon={<ListIcon size={26} />}
          title={t("No changes recorded yet")}
        />
      ) : (
        <ol className="adm-audit">
          {entries.map((e) => {
            const details = compact(e.details);
            const action = e.action ?? "";
            return (
              <li key={e.id} className={`act-${action.split(".")[0] ?? "x"}`}>
                <span className="adm-audit-dot" aria-hidden />
                <div className="adm-audit-body">
                  <div className="adm-audit-head">
                    <strong>
                      {ACTIONS[action] ? t(ACTIONS[action]!) : action}
                    </strong>
                    <code>{action}</code>
                  </div>
                  <span className="small muted">
                    {formatDate(e.createdAt, locale) ?? "—"} ·{" "}
                    {e.adminId
                      ? (names.get(e.adminId) ?? e.adminId)
                      : t("System")}
                  </span>
                  {details && (
                    <pre className="adm-audit-details">{details}</pre>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
