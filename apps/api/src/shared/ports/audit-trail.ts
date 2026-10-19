/** Port (admin module): append-only audit trail of admin actions. */
export interface AuditTrail {
  record(adminId: string, action: string, details: unknown): Promise<void>;
}
