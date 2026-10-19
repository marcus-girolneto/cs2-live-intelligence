import type { Db } from "./database.js";

/**
 * Unit of Work: runs `work` against repositories that share one transaction, so writes that
 * span repositories (e.g. a plan grant, its retention clamp and the audit entry) commit or
 * roll back together.
 */
export interface UnitOfWork<Scope> {
  run<T>(work: (scope: Scope) => Promise<T>): Promise<T>;
}

/** Postgres unit of work: `scope(tx)` builds the repositories bound to the transaction. */
export class PgUnitOfWork<Scope> implements UnitOfWork<Scope> {
  constructor(
    private readonly db: Db,
    private readonly scope: (tx: Db) => Scope,
  ) {}
  run<T>(work: (scope: Scope) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) => work(this.scope(tx)));
  }
}

/** No transaction: hands the same scope to the work (in-memory fakes and unit tests). */
export class DirectUnitOfWork<Scope> implements UnitOfWork<Scope> {
  constructor(private readonly scope: Scope) {}
  run<T>(work: (scope: Scope) => Promise<T>): Promise<T> {
    return work(this.scope);
  }
}
