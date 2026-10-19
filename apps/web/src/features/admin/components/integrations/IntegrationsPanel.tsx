"use client";
import { useI18n } from "@/shared/i18n";
import { Card, Copy, External, Gamepad, ShieldCheck } from "@/shared/icons";
import { Callout, Skeleton } from "@/shared/ui";
import { useIntegrations } from "../../hooks/useIntegrations";
import { webhookUrl } from "../../model/integrations";
import { IntegrationCard } from "./IntegrationCard";
import { SecretField } from "./SecretField";

/** Admin → Integrations: Steam Web API and Stripe keys, stored encrypted, applied live. */
export function IntegrationsPanel({
  onForbidden,
}: {
  onForbidden: () => void;
}) {
  const { t } = useI18n();
  const {
    api,
    data,
    error,
    notice,
    busy,
    testing,
    tests,
    pk,
    setPk,
    copied,
    setCopied,
    run,
    test,
  } = useIntegrations(onForbidden);
  if (!data && !error) return <Skeleton height={320} />;
  const steam = data?.steam;
  const stripe = data?.stripe;
  const hook = webhookUrl(data?.apiPublicUrl ?? null);
  const pkProblem =
    pk.trim() && !/^pk_(live|test)_/.test(pk.trim())
      ? "Publishable keys start with pk_live_ or pk_test_."
      : "";
  return (
    <div className="integ-panel">
      <Callout tone="info">
        <ShieldCheck size={14} />{" "}
        {t(
          "Changes apply immediately and are stored encrypted in the database — no restart needed.",
        )}
      </Callout>
      {error && (
        <Callout tone="error" role="alert">
          {t(error)}
        </Callout>
      )}
      {notice && (
        <Callout tone="success" role="status">
          {notice}
        </Callout>
      )}
      {steam && stripe && (
        <div className="integ-grid">
          <IntegrationCard
            id="steam"
            icon={<Gamepad size={22} />}
            title={t("Steam Web API")}
            sub={t(
              "Profiles, avatars and the account checks behind welcome credits.",
            )}
            configured={steam.configured}
            source={steam.source}
            updatedAt={steam.updatedAt}
            testing={testing === "steam"}
            result={tests.steam?.result ?? null}
            testError={tests.steam?.error ?? ""}
            onTest={() => void test("steam")}
            help={
              <p>
                {t(
                  "Create a key on the Steam developer page (signed in with the account that owns this site):",
                )}{" "}
                <a
                  href="https://steamcommunity.com/dev/apikey"
                  target="_blank"
                  rel="noreferrer"
                >
                  steamcommunity.com/dev/apikey <External size={12} />
                </a>
              </p>
            }
          >
            <SecretField
              label={t("Web API key")}
              kind="steam"
              last4={steam.last4}
              stored={steam.source === "database"}
              readOnlyEnv={steam.source === "env"}
              placeholder="32 hex characters"
              busy={busy}
              onSave={(v) => run(() => api.saveSteam(v), "Steam key saved.")}
              onRemove={() => {
                if (window.confirm(t("Remove the stored Steam key?")))
                  void run(() => api.saveSteam(null), "Steam key removed.");
              }}
            />
          </IntegrationCard>

          <IntegrationCard
            id="stripe"
            icon={<Card size={22} />}
            title={t("Stripe")}
            sub={t("Plan subscriptions and credit pack checkout.")}
            configured={stripe.configured}
            source={stripe.source}
            updatedAt={stripe.updatedAt}
            testing={testing === "stripe"}
            result={tests.stripe?.result ?? null}
            testError={tests.stripe?.error ?? ""}
            onTest={() => void test("stripe")}
            help={
              <>
                <p>
                  {t(
                    "Keys: Stripe Dashboard → Developers → API keys. Webhook: Developers → Webhooks → Add endpoint, then copy its signing secret.",
                  )}
                </p>
                <p className="integ-hook">
                  <span className="muted">{t("Webhook URL")}</span>
                  <code>{hook ?? "<API public URL>/v1/billing/webhook"}</code>
                  {hook && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        void navigator.clipboard
                          ?.writeText(hook)
                          .then(() => setCopied(true))
                      }
                    >
                      <Copy size={14} /> {copied ? t("Copied") : t("Copy")}
                    </button>
                  )}
                </p>
              </>
            }
          >
            <SecretField
              label={t("Secret key")}
              kind="stripe_secret"
              last4={stripe.secretKeyLast4}
              stored={stripe.source === "database" && stripe.configured}
              readOnlyEnv={stripe.source === "env"}
              placeholder="sk_live_… / sk_test_…"
              busy={busy}
              onSave={(v) =>
                run(
                  () => api.saveStripe({ secretKey: v }),
                  "Stripe secret key saved.",
                )
              }
              onRemove={() => {
                if (window.confirm(t("Remove the stored Stripe secret key?")))
                  void run(
                    () => api.saveStripe({ secretKey: null }),
                    "Stripe secret key removed.",
                  );
              }}
            />
            <SecretField
              label={t("Webhook signing secret")}
              kind="stripe_webhook"
              last4={null}
              stored={stripe.webhookConfigured && stripe.source === "database"}
              readOnlyEnv={stripe.webhookConfigured && stripe.source === "env"}
              placeholder="whsec_…"
              busy={busy}
              onSave={(v) =>
                run(
                  () => api.saveStripe({ webhookSecret: v }),
                  "Webhook secret saved.",
                )
              }
              onRemove={() => {
                if (window.confirm(t("Remove the stored webhook secret?")))
                  void run(
                    () => api.saveStripe({ webhookSecret: null }),
                    "Webhook secret removed.",
                  );
              }}
            />
            <form
              className="integ-pk"
              onSubmit={(e) => {
                e.preventDefault();
                if (pkProblem) return;
                void run(
                  () => api.saveStripe({ publishableKey: pk.trim() || null }),
                  "Publishable key saved.",
                );
              }}
            >
              <label>
                {t("Publishable key (public)")}
                <input
                  value={pk}
                  spellCheck={false}
                  autoComplete="off"
                  placeholder="pk_live_… / pk_test_…"
                  aria-invalid={!!pkProblem}
                  onChange={(e) => setPk(e.target.value)}
                />
                {pkProblem && (
                  <span className="field-error">{t(pkProblem)}</span>
                )}
              </label>
              <button
                className="btn btn-ghost btn-sm"
                disabled={busy || pk.trim() === (stripe.publishableKey ?? "")}
              >
                {t("Save")}
              </button>
            </form>
            <label className="check integ-toggle">
              <input
                type="checkbox"
                checked={stripe.enabled}
                disabled={busy || (!stripe.configured && !stripe.enabled)}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  void run(
                    () => api.saveStripe({ enabled }),
                    enabled ? "Payments enabled." : "Payments disabled.",
                  );
                }}
              />
              <span>
                {t("Accept payments")}
                <span className="field-hint block">
                  {stripe.configured
                    ? t("When off, checkout buttons show “Coming soon”.")
                    : t("Add the secret key first.")}
                </span>
              </span>
            </label>
          </IntegrationCard>
        </div>
      )}
    </div>
  );
}
