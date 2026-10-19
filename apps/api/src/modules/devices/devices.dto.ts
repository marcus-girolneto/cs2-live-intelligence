import { pairingClaimSchema, pairingRequestSchema } from "@cs2/contracts";

/** POST /v1/devices/pair and /v1/devices/claim bodies (shared with the collector). */
export const pairRequestSchema = pairingRequestSchema;
export const claimRequestSchema = pairingClaimSchema;

export type DeviceDto = {
  deviceId: string;
  name: string;
  createdAt: string;
  revokedAt: string | null;
};
export type DeviceListDto = { devices: DeviceDto[] };
export type PairingCodeDto = { code: string; expiresAt: string };
export type ClaimedDeviceDto = { deviceId: string; token: string };
