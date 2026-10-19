"use client";
import type { ParsedObject } from "../model/providerForm";
import { useI18n } from "@/shared/i18n";
import { Check } from "@/shared/icons";
export function JsonHint({
  parsed,
  dirty,
}: {
  parsed: ParsedObject;
  dirty: boolean;
}) {
  const { t } = useI18n();
  if (!dirty) return null;
  return parsed.ok ? (
    <span className="field-hint good">
      <Check size={12} />{" "}
      {t("Valid JSON · {n} key(s)", { n: Object.keys(parsed.value).length })}
    </span>
  ) : (
    <span className="field-hint bad" role="alert">
      {t(parsed.error)}
    </span>
  );
}
