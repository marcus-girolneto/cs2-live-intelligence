import type { AdminUserDto, AuditEntryDto } from "./admin.dto.js";
import type { FastifyRequest } from "fastify";
import { ownerOf } from "../../shared/http/principal.js";
import { parseDto } from "../../shared/http/validation.js";
import { auditLimit, roleRequestSchema } from "./admin.dto.js";
import type { AdminService } from "./admin.service.js";

export class AdminController {
  constructor(private readonly admin: AdminService) {}

  users = async (): Promise<{ users: AdminUserDto[] }> => this.admin.users();

  changeRole = async (
    request: FastifyRequest<{ Params: { id: string } }>,
  ): Promise<AdminUserDto | undefined> => {
    const body = parseDto(
      roleRequestSchema,
      request.body,
      "role must be user or admin",
    );
    return this.admin.changeRole(
      ownerOf(request),
      request.params.id,
      body.role,
    );
  };

  audit = async (
    request: FastifyRequest<{ Querystring: { limit?: string } }>,
  ): Promise<{ entries: AuditEntryDto[] }> =>
    this.admin.auditLog(auditLimit(request.query.limit));
}
