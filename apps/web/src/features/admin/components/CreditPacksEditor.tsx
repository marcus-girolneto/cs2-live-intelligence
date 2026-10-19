"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/shared/i18n";
import { Check, Coin, Plus } from "@/shared/icons";
import { Callout, CrosshairLoader, Panel, Skeleton } from "@/shared/ui";
import { useAdminApi } from "../api/context";
import { PACK_ID, type AdminPack } from "../model/credits";
import { money, parseMoney } from "../model/draft";
import { errorText, isForbidden } from "../model/types";

type Draft = AdminPack & { key: number; isNew?: boolean };
let next = 1;
const withKey = (p: AdminPack): Draft => ({ ...p, key: next++ });
const blank = (): Draft => ({
  key: next++,
  isNew: true,
  id: "",
  name: "",
  credits: 10,
  prices: { BRL: 0, USD: 0 },
  badge: null,
  active: true,
  sort: 0,
});

/** Admin: credit packs on sale (id, name, credits, BRL/USD price, badge, on sale or not). */
export function CreditPacksEditor({
  onForbidden,
}: {
  onForbidden: () => void;
}) {
  const { t } = useI18n();
  const api = useAdminApi();
  const [draft, setDraft] = useState<Draft[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    api
      .getPacks()
      .then((p) => setDraft(p.map(withKey)))
      .catch((e: unknown) => {
        if (isForbidden(e)) onForbidden();
        setDraft([]);
        setError(errorText(e, "Request failed."));
      });
  }, [api, onForbidden]);
  const set = (key: number, patch: Partial<Draft>) =>
    setDraft(
      (d) => d && d.map((p) => (p.key === key ? { ...p, ...patch } : p)),
    );
  async function save() {
    if (!draft) return;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      setDraft((await api.savePacks(draft)).map(withKey));
      setNotice(t("Packs saved."));
    } catch (e) {
      setError(errorText(e, "Request failed."));
    } finally {
      setBusy(false);
    }
  }
  const valid =
    !!draft &&
    draft.length > 0 &&
    draft.every((p) => PACK_ID.test(p.id) && p.name.trim() && p.credits > 0) &&
    new Set(draft.map((p) => p.id)).size === draft.length;
  return (
    <Panel
      icon={<Coin size={20} />}
      title={t("Credit packs")}
      sub={t(
        "One-off purchases. Purchased credits never expire. Take a pack off sale instead of deleting it.",
      )}
      actions={
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setDraft((d) => [...(d ?? []), blank()])}
        >
          <Plus size={16} /> {t("Add pack")}
        </button>
      }
    >
      {error && (
        <Callout tone="error" role="alert">
          {t(error)}
        </Callout>
      )}
      {!draft ? (
        <Skeleton height={160} />
      ) : (
        <form
          className="adm-packs"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) void save();
          }}
        >
          {draft.length === 0 && (
            <p className="muted small">{t("No packs on sale.")}</p>
          )}
          {draft.map((p) => (
            <fieldset
              key={p.key}
              className={`adm-plan adm-pack ${p.active ? "" : "off"}`}
            >
              <legend>
                <Coin size={14} /> {p.name || t("New pack")}
              </legend>
              <div className="adm-plan-grid">
                <label>
                  ID
                  <input
                    value={p.id}
                    maxLength={32}
                    pattern="[a-z][a-z0-9_\-]{0,31}"
                    required
                    readOnly={!p.isNew}
                    onChange={(e) =>
                      set(p.key, { id: e.target.value.trim().toLowerCase() })
                    }
                  />
                </label>
                <label>
                  {t("Name")}
                  <input
                    value={p.name}
                    maxLength={64}
                    required
                    onChange={(e) => set(p.key, { name: e.target.value })}
                  />
                </label>
                <label>
                  {t("Credits")}
                  <input
                    type="number"
                    min={1}
                    max={100000}
                    required
                    value={p.credits}
                    onChange={(e) =>
                      set(p.key, {
                        credits: Math.max(
                          0,
                          Math.round(Number(e.target.value) || 0),
                        ),
                      })
                    }
                  />
                </label>
                {(["BRL", "USD"] as const).map((cur) => (
                  <label key={cur}>
                    {cur}
                    <input
                      inputMode="decimal"
                      pattern="[0-9]+([.,][0-9]{1,2})?"
                      defaultValue={money(p.prices[cur])}
                      onChange={(e) => {
                        const c = parseMoney(e.target.value);
                        if (c !== undefined)
                          set(p.key, { prices: { ...p.prices, [cur]: c } });
                      }}
                    />
                  </label>
                ))}
                <label>
                  {t("Badge")}
                  <select
                    value={p.badge ?? ""}
                    onChange={(e) =>
                      set(p.key, { badge: e.target.value || null })
                    }
                  >
                    <option value="">{t("None")}</option>
                    <option value="popular">{t("Most popular")}</option>
                    <option value="best_value">{t("Best value")}</option>
                  </select>
                </label>
              </div>
              <label className="check">
                <input
                  type="checkbox"
                  checked={p.active}
                  onChange={(e) => set(p.key, { active: e.target.checked })}
                />
                {t("Available for sale")}
              </label>
            </fieldset>
          ))}
          {notice && (
            <Callout tone="success" role="status">
              {notice}
            </Callout>
          )}
          <div className="form-actions">
            <button className="btn btn-primary" disabled={busy || !valid}>
              {busy ? <CrosshairLoader size={18} /> : <Check size={18} />}{" "}
              {t("Save packs")}
            </button>
          </div>
        </form>
      )}
    </Panel>
  );
}
