"use client";
import { useId, useState, type KeyboardEvent } from "react";
import { useI18n } from "@/shared/i18n";
import { Film, Monitor } from "@/shared/icons";
import type { Mode } from "../model/showcase";
import { LivePreview } from "./LivePreview";
import { PostMatchPreview } from "./PostMatchPreview";

const MODES: { id: Mode; label: string; sub: string; icon: typeof Film }[] = [
  {
    id: "post",
    label: "After the match",
    sub: "Demo → AI Coach report",
    icon: Film,
  },
  {
    id: "live",
    label: "During the match",
    sub: "AI IGL on your second screen",
    icon: Monitor,
  },
];

/** Hero switcher between the two modes, each with its own animated product preview. */
export function ModeShowcase() {
  const { t } = useI18n();
  const id = useId();
  const [mode, setMode] = useState<Mode>("post");
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next = mode === "post" ? "live" : "post";
    setMode(next);
    document.getElementById(`${id}-tab-${next}`)?.focus();
  };
  return (
    <div className="mode-showcase">
      <div
        className="mode-tabs"
        role="tablist"
        aria-label={t("Two ways to improve")}
        onKeyDown={onKey}
      >
        {MODES.map(({ id: m, label, sub, icon: Icon }) => (
          <button
            key={m}
            id={`${id}-tab-${m}`}
            type="button"
            role="tab"
            aria-selected={mode === m}
            aria-controls={`${id}-panel`}
            tabIndex={mode === m ? 0 : -1}
            className={`mode-tab ${mode === m ? "on" : ""}`}
            onClick={() => setMode(m)}
          >
            <Icon size={20} />
            <span>
              <b>{t(label)}</b>
              <small>{t(sub)}</small>
            </span>
          </button>
        ))}
      </div>
      <div
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-tab-${mode}`}
        className="mode-panel"
      >
        {mode === "post" ? <PostMatchPreview /> : <LivePreview />}
      </div>
    </div>
  );
}
