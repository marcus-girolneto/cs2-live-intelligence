"use client";
import { useI18n } from "@/shared/i18n";
import { Trash } from "@/shared/icons";
import { Panel } from "@/shared/ui";
import type { SettingsVM } from "../hooks/useSettings";
/** Account deletion (type DELETE to confirm). */
export function DangerPanel({ vm }: { vm: SettingsVM }) {
  const { t } = useI18n();
  const { owner, confirmation, setConfirmation, busy, remove } = vm;
  return (
    <Panel
      id="danger"
      className="tone-danger"
      icon={<Trash size={20} />}
      title={t("Delete account & data")}
    >
      <p className="muted">
        {t(
          "This removes your account, devices, sessions and analysis records immediately. Uploaded files are queued for removal by the hourly cleanup worker. This action cannot be undone.",
        )}
      </p>
      <div className="inline-form">
        <label>
          {t("Type DELETE to confirm")}
          <input
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            autoComplete="off"
          />
        </label>
        <button
          type="button"
          className="btn btn-danger"
          disabled={busy || !owner || confirmation !== "DELETE"}
          onClick={() => void remove()}
        >
          <Trash size={18} /> {t("Delete account and data")}
        </button>
      </div>
    </Panel>
  );
}
