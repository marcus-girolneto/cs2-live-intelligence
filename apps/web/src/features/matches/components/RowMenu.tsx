"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useI18n } from "@/shared/i18n";
import { More } from "@/shared/icons";

/** "⋯" menu of a match row: claim the demo or mark it as someone else's. */
export function RowMenu({
  label,
  onMine,
  onExternal,
}: {
  label: string;
  onMine: () => void;
  onExternal: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e.type === "pointerdown" && ref.current?.contains(e.target as Node))
        return;
      setOpen(false);
    };
    window.addEventListener("keydown", close);
    window.addEventListener("pointerdown", close);
    return () => {
      window.removeEventListener("keydown", close);
      window.removeEventListener("pointerdown", close);
    };
  }, [open]);
  const pick = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  return (
    <div className="row-menu" ref={ref}>
      <button
        type="button"
        className="row-menu-btn"
        aria-label={t("Options for {match}", { match: label })}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        <More size={18} />
      </button>
      {open && (
        <ul id={id} role="menu" className="row-menu-list">
          <li role="none">
            <button type="button" role="menuitem" onClick={pick(onMine)}>
              {t("This is my match → pick which player I am")}
            </button>
          </li>
          <li role="none">
            <button type="button" role="menuitem" onClick={pick(onExternal)}>
              {t("Not my match")}
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
