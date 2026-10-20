"use client";
import { formatDate } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { Refresh } from "@/shared/icons";
import type { Delivery } from "../model/types";

/** The latest webhook deliveries and their outcome. */
export function DeliveriesList({
  deliveries,
  onRefresh,
}: {
  deliveries: Delivery[];
  onRefresh: () => void;
}) {
  const { t, locale } = useI18n();
  const status = (d: Delivery) =>
    d.status === "delivered"
      ? t("Delivered")
      : d.status === "failed"
        ? t("Failed")
        : t("Retrying");
  return (
    <>
      <div className="devices-head">
        <h3>{t("Recent deliveries")}</h3>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onRefresh}
        >
          <Refresh size={16} /> {t("Refresh")}
        </button>
      </div>
      {deliveries.length === 0 ? (
        <p className="muted small">{t("No deliveries yet.")}</p>
      ) : (
        <ul className="dev-deliveries">
          {deliveries.map((d) => (
            <li key={d.id}>
              <code>{d.event}</code>
              <span
                className={
                  d.status === "delivered"
                    ? "good"
                    : d.status === "failed"
                      ? "bad"
                      : ""
                }
              >
                {status(d)}
              </span>
              <small>
                {d.lastStatus ? `HTTP ${d.lastStatus}` : (d.lastError ?? "")}
                {" · "}
                {t("{n} attempts", { n: d.attempts })} ·{" "}
                {formatDate(d.createdAt, locale) ?? "–"}
              </small>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
