"use client";
import { useI18n } from "@/shared/i18n";
import { External, Server } from "@/shared/icons";
import { Panel } from "@/shared/ui";
import { useApiKeys } from "../hooks/useApiKeys";
import { useWebhooks } from "../hooks/useWebhooks";
import { ApiKeysSection } from "./ApiKeysSection";
import { WebhooksSection } from "./WebhooksSection";

/** Settings → Developers: API keys, webhooks and a link to the public API docs. */
export function DevelopersPanel() {
  const { t } = useI18n();
  const keys = useApiKeys();
  const webhooks = useWebhooks();
  const docsUrl = keys.list?.docsUrl;
  return (
    <Panel
      id="developers"
      icon={<Server size={20} />}
      title={t("Developers")}
      sub={t(
        "Use the FragMind API to upload demos, read analyses and request AI reviews from your own tools.",
      )}
      actions={
        docsUrl ? (
          <a
            className="btn btn-ghost btn-sm"
            href={docsUrl}
            target="_blank"
            rel="noreferrer"
          >
            <External size={14} /> {t("API docs")}
          </a>
        ) : undefined
      }
    >
      {keys.list && (
        <p className="muted small">
          {t("Base URL")}: <code>{keys.list.baseUrl}</code>
        </p>
      )}
      <ApiKeysSection vm={keys} />
      <WebhooksSection vm={webhooks} />
    </Panel>
  );
}
