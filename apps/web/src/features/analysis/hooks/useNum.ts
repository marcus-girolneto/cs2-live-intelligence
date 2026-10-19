"use client";
import { formatNumber } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
export function useNum() {
  const { locale } = useI18n();
  return (v: unknown, d = 0) => formatNumber(v, d, locale);
}
