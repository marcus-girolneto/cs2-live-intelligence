/**
 * Observer: modules that revoke an owner's access (logout, device rotation/revocation,
 * consent withdrawal, account deletion) publish here; the live module subscribes to close the
 * owner's WebSockets and forget their pending tickets.
 */
export interface OwnerInvalidation {
  invalidate(ownerId: string): void;
}

export class OwnerInvalidationBus implements OwnerInvalidation {
  private readonly listeners: Array<(ownerId: string) => void> = [];
  subscribe(listener: (ownerId: string) => void): void {
    this.listeners.push(listener);
  }
  invalidate(ownerId: string): void {
    for (const listener of this.listeners) listener(ownerId);
  }
}
