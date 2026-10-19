"use client";
import { useId, useState } from "react";
import { useI18n } from "@/shared/i18n";
import { Check, Close, Key, Trash } from "@/shared/icons";
import { secretProblem } from "../../model/integrations";

type Kind = Parameters<typeof secretProblem>[0];

/**
 * Write-only secret: shows "•••• 1234" (never the value), with Replace / Remove. The new value
 * lives only in this input until it is sent; it is never echoed back.
 */
export function SecretField({
  label,
  kind,
  last4,
  stored,
  readOnlyEnv,
  placeholder,
  busy,
  onSave,
  onRemove,
}: {
  label: string;
  kind: Kind;
  last4: string | null;
  /** A value is stored in the database (Remove is offered). */
  stored: boolean;
  /** Only a .env value exists: it can be overridden, not removed from here. */
  readOnlyEnv?: boolean;
  placeholder: string;
  busy: boolean;
  onSave: (value: string) => Promise<boolean>;
  onRemove?: () => void;
}) {
  const { t } = useI18n();
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);
  const problem = secretProblem(kind, value);
  const close = () => {
    setEditing(false);
    setValue("");
    setTouched(false);
  };
  return (
    <div className="secret-field">
      <label htmlFor={id} className="secret-label">
        <Key size={14} /> {label}
      </label>
      {!editing ? (
        <div className="secret-row">
          <code className="secret-mask" aria-label={t(label)}>
            {last4
              ? `•••• •••• ${last4}`
              : stored || readOnlyEnv
                ? "•••• •••• ••••"
                : t("Not set")}
          </code>
          <button
            type="button"
            id={id}
            className="btn btn-ghost btn-sm"
            disabled={busy}
            onClick={() => setEditing(true)}
          >
            <Key size={14} />{" "}
            {stored || readOnlyEnv ? t("Replace") : t("Add key")}
          </button>
          {stored && onRemove && (
            <button
              type="button"
              className="btn btn-ghost btn-sm danger"
              disabled={busy}
              onClick={onRemove}
            >
              <Trash size={14} /> {t("Remove")}
            </button>
          )}
        </div>
      ) : (
        <form
          className="secret-edit"
          onSubmit={(e) => {
            e.preventDefault();
            setTouched(true);
            if (problem) return;
            void onSave(value.trim()).then((ok) => ok && close());
          }}
        >
          <input
            id={id}
            type="password"
            autoComplete="off"
            spellCheck={false}
            autoFocus
            placeholder={placeholder}
            value={value}
            aria-invalid={touched && !!problem}
            aria-describedby={`${id}-err`}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => value && setTouched(true)}
          />
          <button className="btn btn-primary btn-sm" disabled={busy}>
            <Check size={14} /> {t("Save key")}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={close}
            aria-label={t("Cancel")}
          >
            <Close size={14} />
          </button>
          <span id={`${id}-err`} className="field-error" role="alert">
            {touched && problem ? t(problem) : ""}
          </span>
        </form>
      )}
    </div>
  );
}
