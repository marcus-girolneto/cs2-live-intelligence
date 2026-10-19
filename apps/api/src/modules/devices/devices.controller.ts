import type {
  ClaimedDeviceDto,
  DeviceListDto,
  PairingCodeDto,
} from "./devices.dto.js";
import type { FastifyReply, FastifyRequest } from "fastify";
import { parseDto } from "../../shared/http/validation.js";
import { ownerOf } from "../../shared/http/principal.js";
import { claimRequestSchema, pairRequestSchema } from "./devices.dto.js";
import type { DevicesService } from "./devices.service.js";

type DeviceParams = { Params: { id: string } };

export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  list = async (request: FastifyRequest): Promise<DeviceListDto> =>
    this.devices.list(ownerOf(request));

  pair = async (request: FastifyRequest): Promise<PairingCodeDto> => {
    const body = parseDto(
      pairRequestSchema,
      request.body,
      "Invalid pairing request",
    );
    return this.devices.pair(ownerOf(request), body.name);
  };

  claim = async (request: FastifyRequest): Promise<ClaimedDeviceDto> => {
    const body = parseDto(
      claimRequestSchema,
      request.body,
      "Invalid pairing code",
    );
    return this.devices.claim(body.code);
  };

  rotate = async (
    request: FastifyRequest<DeviceParams>,
  ): Promise<PairingCodeDto> =>
    this.devices.rotate(ownerOf(request), request.params.id);

  revoke = async (
    request: FastifyRequest<DeviceParams>,
    reply: FastifyReply,
  ): Promise<FastifyReply> => {
    await this.devices.revoke(ownerOf(request), request.params.id);
    return reply.code(204).send();
  };
}
