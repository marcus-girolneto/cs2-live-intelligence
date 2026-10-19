"use client";
import type { ReactNode } from "react";
import { formatDate } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { Alert, Check, Database, Gear, Play } from "@/shared/icons";
import type {
  IntegrationSource,
  IntegrationTest,
} from "../../model/integrations";

/** Status pill: Configured · Database / From .env (read-only bootstrap) / Not configured. */
export function SourcePill({
  configured,
  source,
}: {
  configured: boolean;
  source: IntegrationSource;
}) {
  const { t } = useI18n();
  if (configured && source === "database")
    return (
      <span className="chip good integ-pill">
        <Database size={12} /> {t("Configured · Database")}
      </span>
    );
  if (configured && source === "env")
    return (
      <span className="chip ct integ-pill">
        <Gear size={12} /> {t("From .env (read-only bootstrap)")}
      </span>
    );
  return (
    <span className="chip bad integ-pill">
      <Alert size={12} /> {t("Not configured")}
    </span>
  );
}

/** One integration: header with status, help, fields, then Test with its result. */
export function IntegrationCard({
  id,
  icon,
  title,
  sub,
  configured,
  source,
  updatedAt,
  help,
  children,
  testing,
  result,
  testError,
  onTest,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  sub: string;
  configured: boolean;
  source: IntegrationSource;
  updatedAt: string | null;
  help: ReactNode;
  children: ReactNode;
  testing: boolean;
  result: IntegrationTest | null;
  testError: string;
  onTest: () => void;
}) {
  const { t, locale } = useI18n();
  const when = formatDate(updatedAt, locale);
  return (
    <section
      className={`integ-card ${configured ? "on" : "off"}`}
      aria-labelledby={`integ-${id}`}
      data-testid={`integration-${id}`}
    >
      <header className="integ-head">
        <span className="integ-icon" aria-hidden>
          {icon}
        </span>
        <div>
          <h3 id={`integ-${id}`}>{title}</h3>
          <p className="small muted">{sub}</p>
        </div>
        <SourcePill configured={configured} source={source} />
      </header>
      <div className="integ-help small">{help}</div>
      <div className="integ-fields">{children}</div>
      <footer className="integ-foot">
        <span className="small muted">
          {when ? t("Last changed {date}", { date: when }) : ""}
        </span>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={testing || !configured}
          onClick={onTest}
        >
          <Play size={14} /> {testing ? t("Testing…") : t("Test")}
        </button>
      </footer>
      {(result || testError) && (
        <p
          className={`integ-test ${result?.ok && !testError ? "good" : "bad"}`}
          role="status"
        >
          {testError ? (
            <>
              <Alert size={14} /> {t(testError)}
            </>
          ) : result?.ok ? (
            <>
              <Check size={14} /> {t("Connected")}
              {result.latencyMs !== null &&
                ` · ${t("{ms} ms", { ms: result.latencyMs })}`}
              {result.livemode !== null &&
                ` · ${result.livemode ? t("Live mode") : t("Test mode")}`}
              {result.detail && ` · ${result.detail}`}
            </>
          ) : (
            <>
              <Alert size={14} /> {t("The test failed.")}
              {result?.detail && ` ${result.detail}`}
            </>
          )}
        </p>
      )}
    </section>
  );
}
