"use client";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useI18n } from "../i18n";
import { GLOSSARY, type GlossaryId } from "./glossary";

const WIDTH = 280;

/**
 * Jargon with an inline explainer: hover or focus shows it on desktop, a tap toggles it on
 * touch screens, Escape closes it. The popover is fixed-positioned and clamped to the
 * viewport, so it never causes horizontal scroll.
 */
export function Term({
  id,
  children,
}: {
  id: GlossaryId;
  /** What to show inline (defaults to the term itself). */
  children?: ReactNode;
}) {
  const { t } = useI18n();
  const tipId = useId();
  const ref = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const entry = GLOSSARY[id];
  const show = useCallback(() => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const w = Math.min(WIDTH, window.innerWidth - 16);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
    setPos({ left, top: r.bottom + 6 });
  }, []);
  const hide = useCallback(() => setPos(null), []);
  useEffect(() => {
    if (!pos) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e.type === "pointerdown" && ref.current?.contains(e.target as Node))
        return;
      hide();
    };
    window.addEventListener("keydown", close);
    window.addEventListener("pointerdown", close);
    window.addEventListener("scroll", hide, { passive: true });
    return () => {
      window.removeEventListener("keydown", close);
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("scroll", hide);
    };
  }, [pos, hide]);
  return (
    <>
      <button
        ref={ref}
        type="button"
        className="term"
        aria-describedby={pos ? tipId : undefined}
        aria-expanded={!!pos}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={() => (pos ? hide() : show())}
      >
        {children ?? t(entry.term)}
      </button>
      {pos && (
        <span
          id={tipId}
          role="tooltip"
          className="term-tip"
          style={{ left: pos.left, top: pos.top }}
        >
          <b>{t(entry.term)}</b> {t(entry.explain)}
        </span>
      )}
    </>
  );
}
