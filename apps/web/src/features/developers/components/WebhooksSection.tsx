"use client";
import type { FormEvent } from "react";
import { formatDate } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { Bolt, Globe, Plus, Trash } from "@/shared/icons";
import { Callout } from "@/shared/ui";
import type { WebhooksVM } from "../hooks/useWebhooks";
import { looksLikeWebhookUrl } from "../model/keys";
import { WEBHOOK_EVENTS } from "../model/types";
import { DeliveriesList } from "./DeliveriesList";
import { eventLabel } from "./labels";
import { SecretReveal } from "./SecretReveal";

/** Register, test and delete webhooks; recent deliveries. */
export function WebhooksSection({ vm }: { vm: WebhooksVM }) {
  const { t, locale } = useI18n();
  function submit(event: FormEvent) {
    event.preventDefault();
    void vm.create();
  }
  return (
    <div className="dev-section">
      <h3>{t("Webhooks")}</h3>
      <p className="muted small">
        {t(
          "We POST a signed JSON event to your HTTPS endpoint when a demo is analysed, fails, or an AI review is ready. Verify the FragMind-Signature header with your signing secret.",
        )}
      </p>
      {vm.error && (
        <Callout tone="error" role="alert">
          {vm.error}
        </Callout>
      )}
      {vm.created && (
        <SecretReveal
          label={t("Signing secret")}
          value={vm.created.secret}
          testId="webhook-secret"
          onDismiss={vm.dismissCreated}
        />
      )}
      <form className="dev-form" onSubmit={submit}>
        <label>
          {t("Endpoint URL")}
          <input
            type="url"
            required
            maxLength={2048}
            placeholder="https://example.com/fragmind"
            value={vm.url}
            onChange={(e) => vm.setUrl(e.target.value)}
          />
        </label>
        <fieldset className="dev-checks">
          <legend>{t("Events")}</legend>
          {WEBHOOK_EVENTS.map((event) => (
            <label key={event} className="dev-check">
              <input
                type="checkbox"
                checked={vm.events.includes(event)}
                onChange={() => vm.toggleEvent(event)}
              />
              <span>
                <code>{event}</code> {eventLabel(t, event)}
              </span>
            </label>
          ))}
        </fieldset>
        <button
          className="btn btn-primary"
          disabled={
            vm.busy || !vm.events.length || !looksLikeWebhookUrl(vm.url)
          }
        >
          <Plus size={18} /> {t("Add webhook")}
        </button>
      </form>
      {vm.webhooks.length === 0 ? (
        <p className="muted small">{t("No webhooks yet.")}</p>
      ) : (
        <ul className="device-list">
          {vm.webhooks.map((hook) => {
            const test = vm.tests[hook.id];
            return (
              <li key={hook.id}>
                <Globe size={20} />
                <div>
                  <strong className="dev-url">{hook.url}</strong>
                  <small>
                    <span className={hook.active ? "good" : "bad"}>
                      {hook.active ? t("Active") : t("Disabled")}
                    </span>{" "}
                    · {hook.events.join(", ")} · {t("Created")}{" "}
                    {formatDate(hook.createdAt, locale) ?? "–"}
                  </small>
                  {hook.disabledReason && (
                    <small className="bad">
                      {t("Disabled after repeated failed deliveries.")}
                    </small>
                  )}
                  {test && (
                    <small className={test.delivered ? "good" : "bad"}>
                      {test.delivered
                        ? t("Test delivered (HTTP {status}).", {
                            status: test.status ?? "",
                          })
                        : t("Test failed: {error}", {
                            error: test.error ?? "",
                          })}
                    </small>
                  )}
                </div>
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={vm.busy || !hook.active}
                    onClick={() => void vm.test(hook.id)}
                  >
                    <Bolt size={14} /> {t("Send test event")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    disabled={vm.busy}
                    onClick={() => void vm.remove(hook.id)}
                  >
                    <Trash size={14} /> {t("Delete webhook")}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <DeliveriesList
        deliveries={vm.deliveries}
        onRefresh={() => void vm.load()}
      />
    </div>
  );
}
