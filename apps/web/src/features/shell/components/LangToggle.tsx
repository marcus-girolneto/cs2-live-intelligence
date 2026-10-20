"use client";
import { LANGS, useI18n } from "@/shared/i18n";
export function LangToggle() {
  const { t, lang, setLang } = useI18n();
  return (
    <div className="lang" role="group" aria-label={t("Language")}>
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          aria-pressed={lang === l.code}
          onClick={() => setLang(l.code)}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
