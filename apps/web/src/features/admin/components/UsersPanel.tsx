"use client";
import { useAdminApi } from "../api/context";
import { useMemo, useState } from "react";
import { formatDate, formatNumber } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { Coin, Refresh, Search, Users as UsersIcon } from "@/shared/icons";
import {
  CrosshairLoader,
  Avatar,
  Callout,
  EmptyState,
  Panel,
  Skeleton,
} from "@/shared/ui";
import { useResource } from "../hooks/useResource";
import { errorText, isForbidden, type AdminUser } from "../model/types";
import { UserCreditsDialog } from "./UserCreditsDialog";
import { UserPlanCell } from "./UserPlanCell";
/* ------------------------------------------------------------ users */
export function UsersPanel({
  onForbidden,
  selfId,
}: {
  onForbidden: () => void;
  selfId?: string;
}) {
  const { t, locale } = useI18n();
  const api = useAdminApi();
  const { data, setData, error, loading, reload } = useResource<{
    users?: AdminUser[];
  }>("admin/users", onForbidden);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [credits, setCredits] = useState<{ id: string; name: string } | null>(
    null,
  );
  const users = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = data?.users ?? [];
    return q
      ? list.filter((u) =>
          [u.personaName, u.steamId, u.id].some((v) =>
            v?.toLowerCase().includes(q),
          ),
        )
      : list;
  }, [data, query]);
  async function setRole(u: AdminUser, role: "user" | "admin") {
    const name = u.personaName || u.steamId || u.id;
    if (
      !window.confirm(
        role === "admin"
          ? t(
              "Make {name} an administrator? They will manage models, keys and users.",
              { name },
            )
          : t("Remove administrator rights from {name}?", { name }),
      )
    )
      return;
    setBusy(u.id);
    setNotice("");
    setActionError("");
    try {
      const updated = await api.setRole(u.id, role);
      setData((d) => ({
        users: (d?.users ?? []).map((x) =>
          x.id === u.id ? { ...x, ...(updated ?? {}), role } : x,
        ),
      }));
      setNotice(t("Role updated."));
    } catch (e) {
      if (isForbidden(e)) onForbidden();
      setActionError(errorText(e, "Request failed."));
    } finally {
      setBusy(null);
    }
  }
  const total = data?.users?.length ?? 0;
  const admins = (data?.users ?? []).filter((u) => u.role === "admin").length;
  return (
    <Panel
      title={t("Users & roles")}
      icon={<UsersIcon size={20} />}
      sub={
        total
          ? t("{n} accounts · {a} administrator(s)", { n: total, a: admins })
          : t("Everyone who signed in to this installation.")
      }
      actions={
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => void reload()}
        >
          <Refresh size={16} /> {t("Refresh")}
        </button>
      }
    >
      <label className="adm-search">
        <span className="visually-hidden">{t("Search users")}</span>
        <Search size={16} />
        <input
          type="search"
          placeholder={t("Search by name or SteamID")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {notice && (
        <Callout tone="success" role="status">
          {notice}
        </Callout>
      )}
      {(error || actionError) && (
        <Callout tone="error" role="alert">
          {t(actionError || error)}
        </Callout>
      )}
      {loading && !data ? (
        <Skeleton height={200} />
      ) : users.length === 0 ? (
        <EmptyState
          compact
          icon={<UsersIcon size={26} />}
          title={t("No users found")}
        />
      ) : (
        <div className="table-wrap">
          <table className="table adm-users">
            <thead>
              <tr>
                <th>{t("Player")}</th>
                <th>{t("Role")}</th>
                <th>{t("Plan")}</th>
                <th className="r">{t("Matches")}</th>
                <th className="r">{t("Reviews")}</th>
                <th>{t("Credits")}</th>
                <th>{t("Joined")}</th>
                <th>{t("Last sign-in")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const name =
                  u.personaName?.trim() ||
                  (u.steamId
                    ? `Steam ${u.steamId.slice(-4)}`
                    : t("Local account"));
                const self = u.id === selfId;
                return (
                  <tr key={u.id}>
                    <th scope="row">
                      <span className="adm-user">
                        <Avatar
                          size={36}
                          ring={false}
                          profile={{
                            personaName: name,
                            ...(u.avatarUrl ? { avatarUrl: u.avatarUrl } : {}),
                          }}
                        />
                        <span>
                          <strong>
                            {name}
                            {self && (
                              <span className="chip accent adm-you">
                                {t("You")}
                              </span>
                            )}
                          </strong>
                          <small className="mono muted">
                            {u.steamId ?? u.id}
                          </small>
                        </span>
                      </span>
                    </th>
                    <td>
                      <span className="adm-role">
                        <select
                          aria-label={t("Role of {name}", { name })}
                          value={u.role ?? "user"}
                          disabled={busy === u.id}
                          onChange={(e) =>
                            void setRole(u, e.target.value as "user" | "admin")
                          }
                        >
                          <option value="user">{t("Player")}</option>
                          <option value="admin">{t("Admin")}</option>
                        </select>
                        {busy === u.id && <CrosshairLoader size={18} />}
                      </span>
                    </td>
                    <td>
                      <UserPlanCell userId={u.id} name={name} plan={u.plan} />
                    </td>
                    <td className="r">
                      {formatNumber(u.matches, 0, locale) ?? "—"}
                    </td>
                    <td className="r">
                      {formatNumber(u.reviews, 0, locale) ?? "—"}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        aria-label={t("Credits of {name}", { name })}
                        onClick={() => setCredits({ id: u.id, name })}
                      >
                        <Coin size={16} />
                        {formatNumber(u.credits, 0, locale) ?? t("Manage")}
                      </button>
                    </td>
                    <td className="nowrap">
                      {formatDate(u.createdAt, locale) ?? "—"}
                    </td>
                    <td className="nowrap">
                      {formatDate(u.lastLoginAt, locale) ?? t("Never")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {credits && (
        <UserCreditsDialog
          userId={credits.id}
          name={credits.name}
          onClose={() => {
            setCredits(null);
            void reload();
          }}
        />
      )}
    </Panel>
  );
}
