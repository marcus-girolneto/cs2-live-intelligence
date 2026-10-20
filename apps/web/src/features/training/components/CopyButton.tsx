"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/shared/i18n";
import { Check, Copy } from "@/shared/icons";

/** Copies `text` to the clipboard; the label switches to "Copied" for 2 s. */
export function CopyButton({
  text,
  label,
  className = "btn btn-ghost btn-sm",
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      /* clipboard blocked: the text stays selectable on screen */
    }
  }
  return (
    <button type="button" className={className} onClick={() => void copy()}>
      {copied ? <Check size={14} /> : <Copy size={14} />}
      <span aria-live="polite">
        {copied ? t("Copied") : (label ?? t("Copy"))}
      </span>
    </button>
  );
}
