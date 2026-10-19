"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { useI18n } from "../i18n";
import { Close } from "../icons";

/** Accessible modal shell: Esc closes, focus moves in and is restored on close. */
export function Dialog({
  title,
  sub,
  onClose,
  children,
  className = "",
}: {
  title: ReactNode;
  sub?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const { t } = useI18n();
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    document.body.classList.add("no-scroll");
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key !== "Tab" || !ref.current) return;
      const items = ref.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select, [tabindex="0"]',
      );
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      document.body.classList.remove("no-scroll");
      previous?.focus?.();
    };
  }, []);
  return (
    <div
      className="dlg-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref}
        className={`dlg ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        tabIndex={-1}
      >
        <header className="dlg-head">
          <div>
            <h2 id={`${id}-t`}>{title}</h2>
            {sub && <p className="dlg-sub">{sub}</p>}
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label={t("Close")}
            onClick={onClose}
          >
            <Close size={20} />
          </button>
        </header>
        <div className="dlg-body">{children}</div>
      </div>
    </div>
  );
}
