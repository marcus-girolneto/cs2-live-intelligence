import type { FastifyRequest, preHandlerAsyncHookHandler } from "fastify";
import { ForbiddenError, UnauthorizedError } from "../errors/index.js";
import { bearerToken, type DeviceIdentity, type Role } from "./principal.js";

/** Port: resolves an application session token to its owner. */
export interface SessionAuthenticator {
  ownerForToken(token: string): Promise<string | undefined>;
}
/** Port: an account's role. */
export interface RoleLookup {
  role(ownerId: string): Promise<Role | undefined>;
}
/** Port: resolves a collector's device token. */
export interface DeviceAuthenticator {
  deviceForToken(token: string): Promise<DeviceIdentity | undefined>;
}

/**
 * Whether guard failures carry a machine-readable `code`. The original API answered
 * 401/403 with `{error}` only, except the plans, billing and replay endpoints which also
 * sent `code`; both shapes are preserved per route group.
 */
export type GuardErrorStyle = "plain" | "coded";

/** Guard/Middleware chain: preHandlers that authenticate and authorize, then decorate the request. */
export class AuthGuards {
  constructor(
    private readonly sessions: SessionAuthenticator,
    private readonly roles: RoleLookup,
    private readonly devices: DeviceAuthenticator,
    private readonly style: GuardErrorStyle = "plain",
  ) {}

  /** Same guards with the other error body style. */
  withStyle(style: GuardErrorStyle): AuthGuards {
    return new AuthGuards(this.sessions, this.roles, this.devices, style);
  }

  private unauthorized(): UnauthorizedError {
    return new UnauthorizedError(
      "Unauthorized",
      this.style === "coded" ? { code: "unauthorized" } : {},
    );
  }

  /** The caller's owner id, or throws 401. */
  async authenticate(request: FastifyRequest): Promise<string> {
    const token = bearerToken(request);
    const ownerId = token
      ? await this.sessions.ownerForToken(token)
      : undefined;
    if (!ownerId) throw this.unauthorized();
    return ownerId;
  }

  /** The caller's owner id when an admin, or throws 401/403. */
  async authenticateAdmin(request: FastifyRequest): Promise<string> {
    const ownerId = await this.authenticate(request);
    if ((await this.roles.role(ownerId)) !== "admin")
      throw new ForbiddenError(
        "Administrator role required",
        this.style === "coded" ? { code: "forbidden" } : {},
      );
    return ownerId;
  }

  readonly requireUser: preHandlerAsyncHookHandler = async (request) => {
    request.principal = { ownerId: await this.authenticate(request) };
  };

  readonly requireAdmin: preHandlerAsyncHookHandler = async (request) => {
    request.principal = {
      ownerId: await this.authenticateAdmin(request),
      role: "admin",
    };
  };

  readonly requireDevice: preHandlerAsyncHookHandler = async (request) => {
    const device = await this.devices.deviceForToken(bearerToken(request));
    if (!device) throw this.unauthorized();
    request.device = device;
  };

  /** Role lookup for routes whose response depends on the viewer (admins see more). */
  async isAdmin(ownerId: string): Promise<boolean> {
    return (await this.roles.role(ownerId)) === "admin";
  }
}
