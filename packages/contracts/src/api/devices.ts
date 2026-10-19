export type DeviceDto = {
  deviceId: string;
  name: string;
  createdAt: string;
  revokedAt: string | null;
};
/** GET /v1/devices. */
export type DeviceListDto = { devices: DeviceDto[] };
/** POST /v1/devices/pair and /v1/devices/:id/rotate. */
export type PairingCodeDto = { code: string; expiresAt: string };
/** POST /v1/devices/claim. */
export type ClaimedDeviceDto = { deviceId: string; token: string };
