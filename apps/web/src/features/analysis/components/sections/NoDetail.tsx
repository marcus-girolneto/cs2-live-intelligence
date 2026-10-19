"use client";
import { useI18n } from "@/shared/i18n";
import { Damage } from "@/shared/icons";
import { EmptyState } from "@/shared/ui";
export function NoDetail() {
  const { t } = useI18n();
  return (
    <EmptyState
      compact
      icon={<Damage size={26} />}
      title={t("Detailed data not available")}
    >
      <p>
        {t(
          "This demo was analyzed before shots, hit groups and positions were extracted. Upload it again to get the full breakdown.",
        )}
      </p>
    </EmptyState>
  );
}
