"use client";
import { useState } from "react";
import { useI18n } from "../i18n";
import { Info } from "../icons";
import { Dialog } from "../ui/Dialog";
import { GLOSSARY, GLOSSARY_IDS } from "./glossary";

/** "What do these words mean?" — opens a drawer with every term explained. */
export function GlossaryButton({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={`btn btn-ghost btn-sm glossary-btn ${className}`}
        onClick={() => setOpen(true)}
      >
        <Info size={16} /> {t("Glossary")}
      </button>
      {open && (
        <Dialog
          title={t("What do these words mean?")}
          sub={t("Short explanations of the terms used in your analysis.")}
          className="glossary-dlg"
          onClose={() => setOpen(false)}
        >
          <dl className="glossary">
            {GLOSSARY_IDS.map((id) => (
              <div key={id}>
                <dt>{t(GLOSSARY[id].term)}</dt>
                <dd>{t(GLOSSARY[id].explain)}</dd>
              </div>
            ))}
          </dl>
        </Dialog>
      )}
    </>
  );
}
