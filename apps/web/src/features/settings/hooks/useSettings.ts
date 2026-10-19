"use client";
import type { SettingsDto } from "@/shared/api-types";
import { useEffect, useState, type FormEvent } from "react";
import { useUsage } from "@/features/billing";
import { useI18n } from "@/shared/i18n";
import { useAccount } from "@/shared/session";
import { useSettingsApi } from "../api/context";
import type { Device, Pairing } from "../model/types";
/** Settings screen state: consent/retention, devices/pairing and account deletion. */
export function useSettings() {
  const { t } = useI18n();
  const api = useSettingsApi();
  const { account } = useAccount();
  const [settings, setSettings] = useState<SettingsDto | null>(null);
  const { limits, isAdmin } = useUsage();
  const retentionMax = isAdmin ? 365 : (limits?.retentionDays ?? 30);
  const [devices, setDevices] = useState<Device[]>([]);
  const [owner, setOwner] = useState<{
    ownerId: string;
    steamId?: string;
  } | null>(null);
  const [name, setName] = useState("My CS2 collector");
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    try {
      const [account, preferences, list] = await Promise.all([
        api.getOwner(),
        api.getSettings(),
        api.listDevices(),
      ]);
      setOwner(account);
      setSettings(preferences);
      setDevices(list);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : t("Could not load your account."),
      );
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Request failed."));
    } finally {
      setBusy(false);
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!settings) return;
    await run(async () => {
      setSettings(await api.saveSettings(settings));
      setNotice(t("Preferences saved."));
    });
  }
  async function pair(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      setPairing(await api.pairDevice(name));
    });
  }
  async function rotate(deviceId: string) {
    if (
      !window.confirm(
        t(
          "Rotate this device credential? Its current credential will stop working. Claim the replacement code from your collector.",
        ),
      )
    )
      return;
    await run(async () => {
      setPairing(await api.rotateDevice(deviceId));
    });
  }
  async function revoke(deviceId: string) {
    if (
      !window.confirm(
        t("Revoke this device? Its collector will stop uploading."),
      )
    )
      return;
    await run(async () => {
      await api.revokeDevice(deviceId);
      await load();
      setNotice(t("Device revoked."));
    });
  }
  async function remove() {
    if (confirmation !== "DELETE") return;
    await run(async () => {
      await api.deleteAccount();
      setSettings(null);
      setOwner(null);
      setDevices([]);

      setPairing(null);
      setConfirmation("");
      setNotice(
        t(
          "Account records deleted. Uploaded files are queued for removal by the hourly cleanup worker.",
        ),
      );
    });
  }
  return {
    account,
    settings,
    setSettings,
    limits,
    isAdmin,
    retentionMax,
    devices,
    setDevices,
    owner,
    setOwner,
    name,
    setName,
    pairing,
    setPairing,
    error,
    notice,
    confirmation,
    setConfirmation,
    busy,
    load,
    run,
    save,
    pair,
    rotate,
    revoke,
    remove,
  };
}
export type SettingsVM = ReturnType<typeof useSettings>;
