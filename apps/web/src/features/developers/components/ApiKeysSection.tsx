"use client";
import type { FormEvent } from "react";
import { formatDate } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { Key, Plus } from "@/shared/icons";
import { Callout } from "@/shared/ui";
import type { ApiKeysVM } from "../hooks/useApiKeys";
import { activeKeys, canCreate, EXPIRY_CHOICES } from "../model/keys";
import { API_SCOPES } from "../model/types";
import { keyStatusLabel, scopeLabel } from "./labels";
import { SecretReveal } from "./SecretReveal";

/** Create, list and revoke personal API keys. */
export function ApiKeysSection({ vm }: { vm: ApiKeysVM }) {
  const { t, locale } = useI18n();
  const { list, keys, created } = vm;
  const full = !!list && activeKeys(list.keys) >= list.maxActive;
  function submit(event: FormEvent) {
    event.preventDefault();
    void vm.create();
  }
  return (
    <div className="dev-section">
      <h3>{t("API keys")}</h3>
      {vm.error && (
        <Callout tone="error" role="alert">
          {vm.error}
        </Callout>
      )}
      {created && (
        <SecretReveal
          label={t("Your new API key")}
          value={created.key}
          testId="api-key-secret"
          onDismiss={vm.dismissCreated}
        />
      )}
      <form className="dev-form" onSubmit={submit}>
        <label>
          {t("Key name")}
          <input
            maxLength={64}
            required
            placeholder={t("e.g. Stats bot")}
            value={vm.name}
            onChange={(e) => vm.setName(e.target.value)}
          />
        </label>
        <fieldset className="dev-checks">
          <legend>{t("Permissions")}</legend>
          {API_SCOPES.map((scope) => (
            <label key={scope} className="dev-check">
              <input
                type="checkbox"
                checked={vm.scopes.includes(scope)}
                onChange={() => vm.toggle(scope)}
              />
              <span>
                <code>{scope}</code> {scopeLabel(t, scope)}
              </span>
            </label>
          ))}
        </fieldset>
        <label>
          {t("Expires")}
          <select
            value={vm.expiresInDays}
            onChange={(e) => vm.setExpiresInDays(Number(e.target.value))}
          >
            {EXPIRY_CHOICES.map((days) => (
              <option key={days} value={days}>
                {days ? t("In {n} days", { n: days }) : t("Never")}
              </option>
            ))}
          </select>
        </label>
        <button
          className="btn btn-primary"
          disabled={vm.busy || full || !canCreate(vm.name, vm.scopes)}
        >
          <Plus size={18} /> {t("Create API key")}
        </button>
        {full && (
          <p className="muted small">
            {t(
              "You reached the limit of active keys. Revoke one to create another.",
            )}
          </p>
        )}
      </form>
      {keys.length === 0 ? (
        <p className="muted small">{t("No API keys yet.")}</p>
      ) : (
        <ul className="device-list">
          {keys.map((key) => (
            <li key={key.id}>
              <Key size={20} />
              <div>
                <strong>{key.name}</strong>
                <small>
                  <code>{key.prefix}…</code> ·{" "}
                  <span className={key.status === "active" ? "good" : "bad"}>
                    {keyStatusLabel(t, key.status)}
                  </span>{" "}
                  · {key.scopes.join(", ")}
                </small>
                <small>
                  {t("Created")} {formatDate(key.createdAt, locale) ?? "–"} ·{" "}
                  {t("Last used")}{" "}
                  {formatDate(key.lastUsedAt, locale) ?? t("Never")}
                  {key.expiresAt &&
                    ` · ${t("Expires")} ${formatDate(key.expiresAt, locale) ?? "–"}`}
                </small>
              </div>
              {key.status === "active" && (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={vm.busy}
                  onClick={() => void vm.revoke(key.id)}
                >
                  {t("Revoke key")}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
