"use client";
import { formatDate } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { Key, Monitor, Plus, Refresh } from "@/shared/icons";
import { Panel } from "@/shared/ui";
import type { SettingsVM } from "../hooks/useSettings";
/** Collector devices: pair, rotate and revoke. */
export function DevicesPanel({ vm }: { vm: SettingsVM }) {
  const { t, locale } = useI18n();
  const {
    devices,
    owner,
    name,
    setName,
    pairing,
    setPairing,
    busy,
    load,
    pair,
    rotate,
    revoke,
  } = vm;
  return (
    <Panel
      id="devices"
      icon={<Key size={20} />}
      title={t("Pair a collector")}
      sub={t(
        "Create a short-lived code and use it in the collector on the PC you play on. The device credential never passes through this browser.",
      )}
    >
      <form className="inline-form" onSubmit={(e) => void pair(e)}>
        <label>
          {t("Device name")}
          <input
            maxLength={80}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <button className="btn btn-primary" disabled={busy || !owner}>
          <Plus size={18} /> {t("Create pairing code")}
        </button>
      </form>
      {pairing && (
        <div className="secret-box">
          <span className="eyebrow">{t("Pairing code")}</span>
          <strong data-testid="pairing-code">{pairing.code}</strong>
          <p className="muted small">
            {t("Expires:")} {formatDate(pairing.expiresAt, locale) ?? "–"} ·{" "}
            {t(
              "Pass this code to the collector pairing command. It can be used once.",
            )}
          </p>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setPairing(null)}
          >
            {t("Hide pairing code")}
          </button>
        </div>
      )}
      <div className="devices-head">
        <h3>{t("Your devices")}</h3>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => void load()}
        >
          <Refresh size={16} /> {t("Refresh devices")}
        </button>
      </div>
      {devices.length === 0 ? (
        <p className="muted small">{t("No paired devices.")}</p>
      ) : (
        <ul className="device-list">
          {devices.map((device) => (
            <li key={device.deviceId}>
              <Monitor size={20} />
              <div>
                <strong>{device.name}</strong>
                <small>
                  {device.deviceId} ·{" "}
                  <span className={device.revokedAt ? "bad" : "good"}>
                    {device.revokedAt ? t("Revoked") : t("Active")}
                  </span>
                </small>
              </div>
              {!device.revokedAt && (
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={busy}
                    onClick={() => void rotate(device.deviceId)}
                  >
                    {t("Rotate credential")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    disabled={busy}
                    onClick={() => void revoke(device.deviceId)}
                  >
                    {t("Revoke device")}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
