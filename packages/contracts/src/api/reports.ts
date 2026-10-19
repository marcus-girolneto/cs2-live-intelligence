import type { MonthlyReport } from "../report.js";

/** GET /v1/reports item. */
export type ReportSummaryDto = {
  id: string;
  period: string;
  source: "scheduled" | "on_demand";
  createdAt: string;
  matches: number;
  headline?: string;
};
/** GET /v1/reports/:id and POST /v1/reports/generate. */
export type ReportDto = ReportSummaryDto & { report: MonthlyReport };
