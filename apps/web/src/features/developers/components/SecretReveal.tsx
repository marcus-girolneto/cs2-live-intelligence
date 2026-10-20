"use client";
import { useState } from "react";
import { useI18n } from "@/shared/i18n";
import { Copy } from "@/shared/icons";

/** A secret shown exactly once (API key or webhook signing secret), with a copy button. */
export function SecretReveal({
  label,
  value,
  onDismiss,
  testId,
}: {
  label: string;
  value: string;
  onDismiss: () => void;
  testId: string;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <div className="secret-box" role="status">
      <span className="eyebrow">{label}</span>
      <code className="dev-secret" data-testid={testId}>
        {value}
      </code>
      <p className="muted small">
        {t(
          "Copy it now and store it somewhere safe. It will not be shown again.",
        )}
      </p>
      <div className="form-actions">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() =>
            void navigator.clipboard
              ?.writeText(value)
              .then(() => setCopied(true))
          }
        >
          <Copy size={14} /> {copied ? t("Copied") : t("Copy")}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onDismiss}
        >
          {t("I saved it")}
        </button>
      </div>
    </div>
  );
}
