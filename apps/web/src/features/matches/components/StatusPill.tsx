"use client";
import { useI18n } from "@/shared/i18n";
import { CrosshairLoader } from "@/shared/ui";
import { STATUS, PENDING } from "../model/status";
export function StatusPill({ status }: { status: string }) {
  const { t } = useI18n();
  const pending = PENDING.includes(status);
  return (
    <span className={`status-pill s-${status}`}>
      {pending ? <CrosshairLoader size={14} /> : <i aria-hidden />}
      {t(STATUS[status] ?? status)}
    </span>
  );
}
