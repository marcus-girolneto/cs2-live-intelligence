"use client";
import { formatNumber } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { Close, Timer } from "@/shared/icons";
import type { UploadState } from "../hooks/useDemoUpload";
import { megabytes, percent, splitDuration } from "../model/upload";

/** Live upload bar: percent, MB sent, speed, ETA and a cancel button. */
export function UploadProgress({
  p,
  onCancel,
}: {
  p: UploadState;
  onCancel: () => void;
}) {
  const { t, locale } = useI18n();
  const pct = percent(p.loaded, p.total);
  const mb = (b: number) => formatNumber(megabytes(b), 1, locale) ?? "0";
  const eta = p.eta === null ? null : splitDuration(p.eta);
  const done = p.total > 0 && p.loaded >= p.total;
  return (
    <div className="upl" role="group" aria-label={t("Upload progress")}>
      <div className="upl-head">
        <b>
          {done ? t("Processing upload…") : t("Uploading… {pct}%", { pct })}
        </b>
        {!done && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onCancel}
          >
            <Close size={14} /> {t("Cancel")}
          </button>
        )}
      </div>
      <div
        className="upl-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={t("Uploaded")}
      >
        <i style={{ width: `${pct}%` }} />
      </div>
      <div className="upl-meta">
        <span>
          {t("{sent} of {total} MB", {
            sent: mb(p.loaded),
            total: mb(p.total),
          })}
        </span>
        {p.rate !== null && (
          <span>{t("{speed} MB/s", { speed: mb(p.rate) })}</span>
        )}
        {eta && !done && (
          <span>
            <Timer size={12} />{" "}
            {eta.m > 0
              ? t("{m} min {s} s left", { m: eta.m, s: eta.s })
              : t("{s} s left", { s: eta.s })}
          </span>
        )}
      </div>
    </div>
  );
}
