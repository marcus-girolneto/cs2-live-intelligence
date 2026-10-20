"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { LANGS, useI18n, type Lang } from "@/shared/i18n";

function Globe() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M3 12h18M12 3c2.6 2.8 3.9 5.8 3.9 9s-1.3 6.2-3.9 9c-2.6-2.8-3.9-5.8-3.9-9S9.4 5.8 12 3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

/**
 * Language dropdown (button + listbox): shows the current language by its native name,
 * opens with Enter/Space/arrows, moves with arrows/Home/End or the first letter, selects
 * with Enter/Space, closes with Escape, Tab or a click outside.
 */
export function LanguageSelect({
  compact = false,
  up = false,
}: {
  /** Only the language code (collapsed sidebar). */
  compact?: boolean;
  /** Open the list above the button (sidebar footer). */
  up?: boolean;
}) {
  const { t, lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();
  const current = LANGS.find((l) => l.code === lang) ?? LANGS[0]!;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    list.current?.focus();
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const show = () => {
    setActive(
      Math.max(
        0,
        LANGS.findIndex((l) => l.code === lang),
      ),
    );
    setOpen(true);
  };
  const choose = (code: Lang) => {
    setOpen(false);
    button.current?.focus();
    if (code !== lang) setLang(code);
  };
  const onButtonKey = (e: KeyboardEvent) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      show();
    }
  };
  const onListKey = (e: KeyboardEvent) => {
    const last = LANGS.length - 1;
    const move = (i: number) => {
      e.preventDefault();
      setActive(Math.max(0, Math.min(last, i)));
    };
    if (e.key === "ArrowDown") return move(active + 1);
    if (e.key === "ArrowUp") return move(active - 1);
    if (e.key === "Home") return move(0);
    if (e.key === "End") return move(last);
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      return choose(LANGS[active]!.code);
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return button.current?.focus();
    }
    if (e.key === "Tab") return setOpen(false);
    if (e.key.length === 1) {
      const k = e.key.toLowerCase();
      const at = LANGS.findIndex(
        (l, i) => i > active && l.label.toLowerCase().startsWith(k),
      );
      const first = LANGS.findIndex((l) => l.label.toLowerCase().startsWith(k));
      if (at >= 0 || first >= 0) move(at >= 0 ? at : first);
    }
  };

  return (
    <div className={`lang-select${up ? " up" : ""}`} ref={root}>
      <button
        ref={button}
        type="button"
        className="lang-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        aria-label={`${t("Language")}: ${current.label}`}
        title={t("Language")}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onButtonKey}
      >
        <Globe />
        <span lang={current.tag}>
          {compact ? current.code.toUpperCase() : current.label}
        </span>
        <span className="lang-caret" aria-hidden />
      </button>
      {open && (
        <ul
          ref={list}
          id={`${id}-list`}
          role="listbox"
          tabIndex={-1}
          aria-label={t("Language")}
          aria-activedescendant={`${id}-${LANGS[active]!.code}`}
          onKeyDown={onListKey}
        >
          {LANGS.map((l, i) => (
            <li
              key={l.code}
              id={`${id}-${l.code}`}
              role="option"
              lang={l.tag}
              aria-selected={l.code === lang}
              className={i === active ? "active" : undefined}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(l.code)}
            >
              {l.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
