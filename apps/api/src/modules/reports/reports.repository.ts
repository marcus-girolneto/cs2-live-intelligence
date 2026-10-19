import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { MonthlyReport } from "@cs2/contracts";
import type { Db } from "../../shared/db/database.js";
import { isoDate } from "../../shared/db/rows.js";

export type ReportSource = "scheduled" | "on_demand";
export type NewReport = {
  ownerId: string;
  period: string;
  source: ReportSource;
  steamId: string | null;
  report: MonthlyReport;
  provider: string | null;
  model: string | null;
  promptVersion: string | null;
};
export type ReportRecord = {
  id: string;
  period: string;
  source: ReportSource;
  report: MonthlyReport;
  provider: string | null;
  model: string | null;
  promptVersion: string | null;
  createdAt: string;
};

/** Stored monthly reports (one scheduled + one on-demand per owner and period). */
export interface ReportsRepository {
  /** Inserts the report; undefined when one already exists for (owner, period, source). */
  insert(report: NewReport): Promise<string | undefined>;
  find(
    ownerId: string,
    period: string,
    source: ReportSource,
  ): Promise<string | undefined>;
  list(ownerId: string, limit: number): Promise<ReportRecord[]>;
  get(ownerId: string, id: string): Promise<ReportRecord | undefined>;
}

const record = (row: Record<string, unknown>): ReportRecord => ({
  id: row.id as string,
  period: row.period as string,
  source: row.source as ReportSource,
  report: row.report as MonthlyReport,
  provider: (row.provider as string | null) ?? null,
  model: (row.model as string | null) ?? null,
  promptVersion: (row.prompt_version as string | null) ?? null,
  createdAt: isoDate(row.created_at),
});

export class PgReportsRepository implements ReportsRepository {
  constructor(private readonly db: Db) {}

  async insert(r: NewReport): Promise<string | undefined> {
    const id = randomUUID();
    const result = await this.db.execute(
      sql`insert into reports(id,owner_id,period,source,steam_id,report,provider,model,prompt_version) values(${id},${r.ownerId},${r.period},${r.source},${r.steamId},${JSON.stringify(r.report)}::jsonb,${r.provider},${r.model},${r.promptVersion})
        on conflict(owner_id,period,source) do nothing returning id`,
    );
    return result.rows.length ? id : undefined;
  }

  async find(
    ownerId: string,
    period: string,
    source: ReportSource,
  ): Promise<string | undefined> {
    const r = await this.db.execute(
      sql`select id from reports where owner_id=${ownerId} and period=${period} and source=${source}`,
    );
    return r.rows[0]?.id as string | undefined;
  }

  async list(ownerId: string, limit: number): Promise<ReportRecord[]> {
    const r = await this.db.execute(
      sql`select id,period,source,report,provider,model,prompt_version,created_at from reports where owner_id=${ownerId} order by period desc,created_at desc limit ${limit}`,
    );
    return r.rows.map(record);
  }

  async get(ownerId: string, id: string): Promise<ReportRecord | undefined> {
    const r = await this.db.execute(
      sql`select id,period,source,report,provider,model,prompt_version,created_at from reports where owner_id=${ownerId} and id=${id}`,
    );
    return r.rows[0] ? record(r.rows[0]) : undefined;
  }
}
