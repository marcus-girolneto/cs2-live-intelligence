import type { SettingsDto } from "@/shared/api-types";
import { platformHttp, seg, webHttp, type HttpClient } from "@/shared/http";
import type { CoachProfile, Device, Pairing } from "../model/types";

/** Account settings: consent/retention, collector devices, coach profile and deletion. */
export interface SettingsApi {
  getOwner(): Promise<{ ownerId: string; steamId?: string }>;
  getSettings(): Promise<SettingsDto>;
  saveSettings(settings: SettingsDto): Promise<SettingsDto>;
  listDevices(): Promise<Device[]>;
  pairDevice(name: string): Promise<Pairing>;
  rotateDevice(deviceId: string): Promise<Pairing>;
  revokeDevice(deviceId: string): Promise<void>;
  /** Deletes the account and its records, then clears the session cookie. */
  deleteAccount(): Promise<void>;
  getCoachProfile(): Promise<CoachProfile>;
  saveCoachProfile(body: Record<string, unknown>): Promise<CoachProfile>;
}

export function createSettingsApi(
  http: HttpClient = platformHttp,
  web: HttpClient = webHttp,
): SettingsApi {
  return {
    getOwner: () => http.get<{ ownerId: string; steamId?: string }>("me"),
    getSettings: () => http.get<SettingsDto>("settings"),
    saveSettings: (settings) => http.put<SettingsDto>("settings", settings),
    listDevices: () =>
      http.get<{ devices: Device[] }>("devices").then((r) => r.devices),
    pairDevice: (name) => http.post<Pairing>("devices/pair", { name }),
    rotateDevice: (deviceId) =>
      http.request<Pairing>(`devices/${seg(deviceId)}/rotate`, {
        method: "POST",
      }),
    revokeDevice: async (deviceId) => {
      await http.delete(`devices/${seg(deviceId)}`);
    },
    deleteAccount: async () => {
      await http.delete("account");
      await web.post("logout").catch(() => undefined);
    },
    getCoachProfile: () => http.get<CoachProfile>("coach/profile"),
    saveCoachProfile: (body) => http.put<CoachProfile>("coach/profile", body),
  };
}
export const settingsApi = createSettingsApi();
