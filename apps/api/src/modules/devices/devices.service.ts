import {
  NotFoundError,
  TooManyRequestsError,
  ValidationError,
} from "../../shared/errors/index.js";
import type { OwnerInvalidation } from "../live/owner-invalidation.js";
import type {
  ClaimedDeviceDto,
  DeviceListDto,
  PairingCodeDto,
} from "./devices.dto.js";
import type { DevicesRepository } from "./devices.repository.js";

/** Collector pairing, token rotation and revocation. Credential changes close live channels. */
export class DevicesService {
  constructor(
    private readonly devices: DevicesRepository,
    private readonly invalidation: OwnerInvalidation,
  ) {}

  async list(ownerId: string): Promise<DeviceListDto> {
    return { devices: await this.devices.list(ownerId) };
  }

  async pair(ownerId: string, name: string): Promise<PairingCodeDto> {
    const code = await this.devices
      .createPairingCode(ownerId, name)
      .catch(() => undefined);
    if (!code) throw new TooManyRequestsError("Pairing limit reached");
    return code;
  }

  async claim(code: string): Promise<ClaimedDeviceDto> {
    const claimed = await this.devices.claim(code);
    if (!claimed) throw new ValidationError("Invalid or expired pairing code");
    return claimed;
  }

  async rotate(ownerId: string, deviceId: string): Promise<PairingCodeDto> {
    const rotated = await this.devices.rotate(ownerId, deviceId);
    if (!rotated) throw new NotFoundError("Device not found");
    this.invalidation.invalidate(ownerId);
    return rotated;
  }

  async revoke(ownerId: string, deviceId: string): Promise<void> {
    if (!(await this.devices.revoke(ownerId, deviceId)))
      throw new NotFoundError("Device not found");
    this.invalidation.invalidate(ownerId);
  }
}
