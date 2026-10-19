"use client";
import { useI18n } from "@/shared/i18n";
import { Brain } from "@/shared/icons";
import type { Line } from "../../model/plain";

/** "What this means for you": 1–3 everyday sentences before any table. */
export function PlainSummary({ lines }: { lines: Line[] }) {
  const { t } = useI18n();
  if (!lines.length) return null;
  return (
    <section
      className="plain-summary"
      aria-label={t("What this means for you")}
    >
      <h3>
        <Brain size={18} /> {t("What this means for you")}
      </h3>
      {lines.map((l) => (
        <p key={l.text}>
          {t(
            l.text,
            l.params && "part" in l.params
              ? { ...l.params, part: t(String(l.params.part)) }
              : l.params,
          )}
        </p>
      ))}
    </section>
  );
}
