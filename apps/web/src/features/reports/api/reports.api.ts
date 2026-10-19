import { platformHttp, seg, type HttpClient } from "@/shared/http";
import {
  normalizeReport,
  normalizeReportList,
  type Report,
  type ReportListItem,
} from "../model/report";

/** Writing a report is an AI call (minutes on large models). */
const AI_TIMEOUT = 10 * 60 * 1000;

/** Monthly performance reports (Pro). */
export interface ReportsApi {
  list(): Promise<ReportListItem[]>;
  get(id: string): Promise<Report>;
  /** Writes this month's report; resolves with the full report when the API returns it. */
  generate(): Promise<{ id: string | null; report: Report | null }>;
}

export function createReportsApi(http: HttpClient = platformHttp): ReportsApi {
  return {
    list: async () => normalizeReportList(await http.get<unknown>("reports")),
    async get(id) {
      const r = normalizeReport(await http.get<unknown>(`reports/${seg(id)}`));
      if (!r) throw new Error("This report could not be loaded.");
      return r;
    },
    async generate() {
      const raw = await http.post<unknown>(
        "reports/generate",
        {},
        { timeoutMs: AI_TIMEOUT },
      );
      const o = raw as Record<string, unknown> | null;
      const full = !!o && (!!o.report || o.period !== undefined);
      const report = full ? normalizeReport(raw) : null;
      const id = report?.id ?? (typeof o?.id === "string" ? o.id : null);
      return { id, report };
    },
  };
}
export const reportsApi = createReportsApi();
