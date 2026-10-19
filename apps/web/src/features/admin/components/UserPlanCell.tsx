"use client";
import { useState } from "react";
import { useI18n } from "@/shared/i18n";
import { formatDate } from "@/shared/format";
import { CrosshairLoader } from "@/shared/ui";
import { DEFAULT_PLANS } from "@/features/billing";
import { useAdminApi } from "../api/context";

type UserPlan =
  { id?: string; name?: string; until?: string | null } | null | undefined;

/** Admin users table: assign a plan (optionally until a date). */
export function UserPlanCell({
  userId,
  name,
  plan,
}: {
  userId: string;
  name: string;
  plan: unknown;
}) {
  const { t, locale } = useI18n();
  const api = useAdminApi();
  const current = (plan && typeof plan === "object" ? plan : null) as UserPlan;
  const [value, setValue] = useState(current?.id ?? "free");
  const [until, setUntil] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function apply(next: string) {
    setBusy(true);
    setMsg("");
    try {
      await api.setUserPlan(
        userId,
        next,
        until ? new Date(`${until}T23:59:59Z`).toISOString() : undefined,
      );
      setValue(next);
      setMsg(t("Plan updated."));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : t("Request failed."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className="adm-plan-cell">
      <select
        aria-label={t("Plan of {name}", { name })}
        value={value}
        disabled={busy}
        onChange={(e) => void apply(e.target.value)}
      >
        {DEFAULT_PLANS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <input
        type="date"
        aria-label={t("Plan valid until (optional)")}
        value={until}
        onChange={(e) => setUntil(e.target.value)}
      />
      {busy && <CrosshairLoader size={16} />}
      {current?.until && !msg && (
        <small className="muted">
          {t("until {date}", { date: formatDate(current.until, locale) ?? "" })}
        </small>
      )}
      {msg && (
        <small className="muted" role="status">
          {msg}
        </small>
      )}
    </span>
  );
}
