import {
  buildMonthlyReport,
  REPORT_PROMPT_VERSION,
  type ReportMatch,
} from "@cs2/coaching";
import { analysisSchema, type DeepReview } from "@cs2/contracts";
import type {
  AiGateway,
  CoachLanguage,
} from "../../infrastructure/ai/coaching-ai-gateway.js";
import type { Clock } from "../../shared/clock/clock.js";
import {
  ConflictError,
  NotFoundError,
  PlanFeatureError,
} from "../../shared/errors/index.js";
import type { Logger } from "../../shared/logging/logger.js";
import { aiRequestError } from "../ai-config/ai-errors.js";
import type { AiAccess, AnalysisHistory } from "../coaching/coaching.ports.js";
import { creditPeriod } from "../credits/credit-period.js";
import type {
  ReportRecord,
  ReportSource,
  ReportsRepository,
} from "./reports.repository.js";

/** Ports this module needs from coaching and plans. */
export interface ReportInputs {
  /** The in-demo identity coached for the account (Steam id for Steam accounts). */
  playerSteamId(ownerId: string): Promise<string | null>;
  deepReviewsBetween(
    ownerId: string,
    steamId: string,
    from: string,
    to: string,
  ): Promise<{ analysisId: string; createdAt: string; deep: DeepReview }[]>;
  monthlyReport(ownerId: string): Promise<boolean>;
  /** The own matches (ids and upload dates only: an indexed query, no documents). */
  completedMatches?(
    ownerId: string,
    limit: number,
  ): Promise<{ id: string; createdAt: string }[]>;
}
export type ReportSummaryDto = {
  id: string;
  period: string;
  source: ReportSource;
  createdAt: string;
  matches: number;
  headline?: string;
};
export type ReportDto = ReportSummaryDto & {
  report: ReportRecord["report"];
  provider?: string | null;
  model?: string | null;
};

const MAX_ANALYSES = 500;
const summary = (r: ReportRecord): ReportSummaryDto => ({
  id: r.id,
  period: r.period,
  source: r.source,
  createdAt: r.createdAt,
  matches: r.report.matches,
  ...(r.report.narrative ? { headline: r.report.narrative.headline } : {}),
});

/**
 * Pro monthly performance reports: deterministic aggregates of the period's analyses and deep
 * reviews plus one AI narrative call (purpose "report", no credits). Scheduled for the previous
 * month in the first days of a month; on demand once per current period.
 */
export class ReportsService {
  constructor(
    private readonly reports: ReportsRepository,
    private readonly history: AnalysisHistory,
    private readonly inputs: ReportInputs,
    private readonly ai: AiAccess,
    private readonly gateway: AiGateway,
    private readonly clock: Clock,
    private readonly logger: Logger,
  ) {}

  async list(ownerId: string): Promise<{ reports: ReportSummaryDto[] }> {
    return { reports: (await this.reports.list(ownerId, 36)).map(summary) };
  }

  async get(ownerId: string, id: string, admin: boolean): Promise<ReportDto> {
    const r = await this.reports.get(ownerId, id);
    if (!r) throw new NotFoundError("Report not found", { code: "not_found" });
    return {
      ...summary(r),
      report: r.report,
      ...(admin ? { provider: r.provider, model: r.model } : {}),
    };
  }

  /** POST /v1/reports/generate: Pro, once per current period; the AI call is required. */
  async generate(ownerId: string, lang: CoachLanguage): Promise<ReportDto> {
    if (!(await this.inputs.monthlyReport(ownerId)))
      throw new PlanFeatureError(
        "monthly_report",
        "pro",
        "Monthly performance reports are included in the Pro plan.",
      );
    const now = this.clock.now();
    const period = creditPeriod(now, this.clock, null);
    const key = this.clock.day(now).slice(0, 7);
    const existing = await this.reports.find(ownerId, key, "on_demand");
    if (existing)
      throw new ConflictError(
        "This month's on-demand report was already generated.",
        {
          code: "report_exists",
          details: { reportId: existing, period: key },
        },
      );
    const config = await this.ai.acquire(ownerId, "report");
    const id = await this.create(
      ownerId,
      key,
      "on_demand",
      period,
      lang,
      async (report) => {
        try {
          return await this.gateway.monthlyReport(report, config, lang);
        } catch (error) {
          throw aiRequestError(error, false);
        }
      },
    );
    if (!id)
      throw new ConflictError(
        "This month's on-demand report was already generated.",
        {
          code: "report_exists",
        },
      );
    return this.get(ownerId, id, false);
  }

  /**
   * Scheduled report of the previous month (worker, first 3 days of a month). Without a
   * configured model the deterministic report is stored without a narrative.
   */
  async scheduled(ownerId: string): Promise<string | undefined> {
    const now = this.clock.now();
    if (Number(this.clock.day(now).slice(8, 10)) > 3) return undefined;
    if (!(await this.inputs.monthlyReport(ownerId))) return undefined;
    const current = creditPeriod(now, this.clock, null);
    const previous = creditPeriod(
      new Date(Date.parse(current.start) - 1),
      this.clock,
      null,
    );
    const key = this.clock.day(new Date(previous.start)).slice(0, 7);
    if (await this.reports.find(ownerId, key, "scheduled")) return undefined;
    const config = await this.ai
      .acquire(ownerId, "report")
      .catch(() => undefined);
    return this.create(
      ownerId,
      key,
      "scheduled",
      previous,
      "en",
      async (report) => {
        if (!config) return { report };
        try {
          return await this.gateway.monthlyReport(report, config, "en");
        } catch (error) {
          this.logger.info(
            { ownerId, err: String(error) },
            "report narrative failed",
          );
          return { report };
        }
      },
    );
  }

  private async create(
    ownerId: string,
    key: string,
    source: ReportSource,
    period: { start: string; end: string },
    lang: CoachLanguage,
    narrate: (report: ReturnType<typeof buildMonthlyReport>) => Promise<{
      report: ReturnType<typeof buildMonthlyReport>;
      call?: { provider: string; model: string };
    }>,
  ): Promise<string | undefined> {
    const steamId = await this.inputs.playerSteamId(ownerId);
    const before = creditPeriod(
      new Date(Date.parse(period.start) - 1),
      this.clock,
      null,
    );
    // Only the documents of matches uploaded in the two compared periods are loaded.
    const inWindow = this.inputs.completedMatches
      ? (await this.inputs.completedMatches(ownerId, MAX_ANALYSES))
          .filter((m) => {
            const t = Date.parse(m.createdAt);
            return t >= Date.parse(before.start) && t < Date.parse(period.end);
          })
          .map((m) => m.id)
      : undefined;
    const analyses = await this.history.completedAnalyses(
      ownerId,
      MAX_ANALYSES,
      ...(inWindow ? [inWindow] : []),
    );
    const within = (from: string, to: string): ReportMatch[] =>
      analyses.flatMap((a) => {
        const t = Date.parse(a.createdAt);
        if (t < Date.parse(from) || t >= Date.parse(to)) return [];
        const parsed = analysisSchema.safeParse(a.analysis);
        return parsed.success
          ? [
              {
                id: a.id,
                filename: a.filename,
                createdAt: a.createdAt,
                analysis: parsed.data,
              },
            ]
          : [];
      });
    const base = buildMonthlyReport({
      period: key,
      steamId,
      matches: within(period.start, period.end),
      previousMatches: within(before.start, before.end),
      deepReviews: steamId
        ? await this.inputs.deepReviewsBetween(
            ownerId,
            steamId,
            period.start,
            period.end,
          )
        : [],
    });
    const { report, call } = await narrate(base);
    this.logger.info({ ownerId, period: key, source, lang }, "monthly report");
    return this.reports.insert({
      ownerId,
      period: key,
      source,
      steamId,
      report,
      provider: call?.provider ?? null,
      model: call?.model ?? null,
      promptVersion: call ? REPORT_PROMPT_VERSION : null,
    });
  }
}
