import { z } from "zod";
import type { Role } from "../../shared/http/principal.js";

/** PUT /v1/admin/users/:id/role. */
export const roleRequestSchema = z
  .object({ role: z.enum(["user", "admin"]) })
  .strict();
export type RoleRequestDto = z.infer<typeof roleRequestSchema>;

/** GET /v1/admin/audit?limit= (1..500, default 100). */
export const auditLimit = (raw: string | undefined): number =>
  Math.min(Math.max(Number(raw) || 100, 1), 500);

export type AdminUserDto = {
  id: string;
  steamId: string | null;
  personaName: string | null;
  avatarUrl: string | null;
  role: Role;
  createdAt: string;
  lastLoginAt: string | null;
  matches: number;
  reviews: number;
};
export type AuditEntryDto = {
  id: string;
  adminId: string | null;
  action: string;
  details: unknown;
  createdAt: string;
};
