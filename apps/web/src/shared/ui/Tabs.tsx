"use client";
import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export type TabDef<T extends string> = {
  id: T;
  label: string;
  icon?: ReactNode;
  badge?: ReactNode;
};
/** Accessible tablist: roving tabindex, arrow/Home/End keys, sticky underline indicator. */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  idBase,
  className = "",
}: {
  tabs: TabDef<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  idBase?: string;
  className?: string;
}) {
  const auto = useId();
  const base = idBase ?? auto;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  function key(e: KeyboardEvent, i: number) {
    const last = tabs.length - 1;
    const next =
      e.key === "ArrowRight"
        ? i === last
          ? 0
          : i + 1
        : e.key === "ArrowLeft"
          ? i === 0
            ? last
            : i - 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : null;
    if (next === null) return;
    e.preventDefault();
    onChange(tabs[next]!.id);
    refs.current[next]?.focus();
  }
  useEffect(() => {
    const i = tabs.findIndex((t) => t.id === value);
    refs.current[i]?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [value, tabs]);
  return (
    <div className={`tabs ${className}`} role="tablist" aria-label={label}>
      {tabs.map((tab, i) => (
        <button
          key={tab.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          role="tab"
          type="button"
          id={`${base}-tab-${tab.id}`}
          aria-controls={`${base}-panel-${tab.id}`}
          aria-selected={value === tab.id}
          tabIndex={value === tab.id ? 0 : -1}
          onClick={() => onChange(tab.id)}
          onKeyDown={(e) => key(e, i)}
        >
          {tab.icon}
          <span>{tab.label}</span>
          {tab.badge}
        </button>
      ))}
    </div>
  );
}
export function TabPanel({
  idBase,
  id,
  children,
  className = "",
}: {
  idBase: string;
  id: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`tab-panel ${className}`}
      role="tabpanel"
      id={`${idBase}-panel-${id}`}
      aria-labelledby={`${idBase}-tab-${id}`}
      tabIndex={0}
    >
      {children}
    </div>
  );
}
