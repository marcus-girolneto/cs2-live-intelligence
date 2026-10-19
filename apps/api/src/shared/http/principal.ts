import type { FastifyRequest } from "fastify";
import { UnauthorizedError } from "../errors/index.js";

export type Role = "user" | "admin";

/** The authenticated caller, attached to the request by the auth guards. */
export interface Principal {
  ownerId: string;
  /** Present when a guard had to resolve it (admin routes). */
  role?: Role;
}
/** A paired telemetry collector authenticated by its device token. */
export interface DeviceIdentity {
  deviceId: string;
  ownerId: string;
  tokenHash?: string;
}

declare module "fastify" {
  interface FastifyRequest {
    principal?: Principal;
    device?: DeviceIdentity;
  }
}

/** Token from `Authorization: Bearer <token>`, or "" when absent/malformed. */
export function bearerToken(request: FastifyRequest): string {
  const header = request.headers.authorization;
  return header?.startsWith("Bearer ") ? header.slice(7) : "";
}

/** The guarded caller's id; only valid on routes protected by a user/admin guard. */
export function ownerOf(request: FastifyRequest): string {
  if (!request.principal) throw new UnauthorizedError();
  return request.principal.ownerId;
}

/** The guarded device; only valid on routes protected by the device guard. */
export function deviceOf(request: FastifyRequest): DeviceIdentity {
  if (!request.device) throw new UnauthorizedError();
  return request.device;
}
