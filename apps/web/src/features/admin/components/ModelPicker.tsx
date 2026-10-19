"use client";
import { useMemo, useState } from "react";
import { useI18n } from "@/shared/i18n";
import { Search } from "@/shared/icons";
/** Text input with a filtered, keyboard-navigable list of suggestions (model ids). */
export function ModelPicker({
  value,
  onChange,
  models,
  label,
  id,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  models: string[];
  label: string;
  id: string;
  placeholder?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    const list = q ? models.filter((m) => m.toLowerCase().includes(q)) : models;
    return list.slice(0, 80);
  }, [models, value]);
  const show = open && models.length > 0;
  function pick(m: string) {
    onChange(m);
    setOpen(false);
  }
  return (
    <label className="model-picker">
      {label}
      <span className={`mp-field ${models.length ? "has-count" : ""}`}>
        <Search size={16} />
        <input
          id={id}
          role="combobox"
          aria-expanded={show}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          value={value}
          placeholder={placeholder ?? t("e.g. gpt-4o-mini")}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (!show) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(filtered.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter" && filtered[active]) {
              e.preventDefault();
              pick(filtered[active]!);
            } else if (e.key === "Escape") setOpen(false);
          }}
        />
        {models.length > 0 && (
          <span className="mp-count">
            {t("{n} models", { n: models.length })}
          </span>
        )}
      </span>
      {show && (
        <ul className="mp-list" role="listbox" id={`${id}-list`}>
          {filtered.length === 0 ? (
            <li className="mp-empty">{t("No model matches")}</li>
          ) : (
            filtered.map((m, i) => (
              <li
                key={m}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(m);
                }}
                onMouseEnter={() => setActive(i)}
              >
                {m}
              </li>
            ))
          )}
        </ul>
      )}
    </label>
  );
}
