import { analysisSchema } from "@cs2/contracts";
import {
  runEval,
  type AiConfig,
  type EvalCase,
  type EvalPurpose,
  type EvalReport,
} from "@cs2/coaching";
import { NotFoundError, ValidationError } from "../../shared/errors/index.js";
import type { AuditTrail } from "../../shared/ports/audit-trail.js";
import type { AiPurpose } from "./ai-config.dto.js";
import type {
  AiQualityRepository,
  RatingRowDto,
} from "./ai-quality.repository.js";
import type { ResolvedAi } from "./ai-settings.service.js";

/** Port: resolved configs per purpose (no daily cap: admin-initiated eval). */
export interface PurposeConfigs {
  resolve(purpose: AiPurpose): Promise<ResolvedAi>;
}
/** Port: an owner's stored analysis (the admin's own matches for the eval). */
export interface EvalAnalyses {
  analysis(
    ownerId: string,
    id: string,
  ): Promise<{ analysis: unknown } | undefined>;
}
export type EvalRunRequest = {
  langs?: ("en" | "pt")[];
  cases?: { name: string; analysis?: unknown; steamId?: string }[];
  analyses?: { analysisId: string; steamId?: string }[];
};

const PURPOSES: EvalPurpose[] = ["review_quick", "review_deep", "review_team"];

/** Admin AI quality: prompt A/B ratings and the nightly eval (run with server-side keys). */
export class AiQualityService {
  constructor(
    private readonly repository: AiQualityRepository,
    private readonly configs: PurposeConfigs,
    private readonly analyses: EvalAnalyses,
    private readonly audit: AuditTrail,
  ) {}

  /** GET /v1/admin/ai/ratings */
  async ratings(): Promise<{ ratings: RatingRowDto[] }> {
    return { ratings: await this.repository.ratings() };
  }

  /** GET /v1/admin/ai/eval/latest (404 when no eval ran yet). */
  async latest(): Promise<{ id: string; createdAt: string; summary: unknown }> {
    const latest = await this.repository.latestEval();
    if (!latest)
      throw new NotFoundError("No AI eval report yet", { code: "not_found" });
    return latest;
  }

  /** POST /v1/admin/ai/eval/run: the golden set through every configured review purpose. */
  async run(
    adminId: string,
    request: EvalRunRequest,
  ): Promise<EvalReport & { id: string }> {
    const cases: EvalCase[] = [];
    for (const c of request.cases ?? []) {
      const parsed = analysisSchema.safeParse(c.analysis);
      if (!parsed.success)
        throw new ValidationError(`Case ${c.name} is not a valid analysis.`);
      cases.push({
        name: c.name,
        analysis: parsed.data,
        ...(c.steamId ? { steamId: c.steamId } : {}),
      });
    }
    for (const a of request.analyses ?? []) {
      const stored = await this.analyses.analysis(adminId, a.analysisId);
      if (!stored) throw new NotFoundError("Analysis not found");
      cases.push({
        name: `analysis-${a.analysisId.slice(0, 8)}`,
        analysis: analysisSchema.parse(stored.analysis),
        ...(a.steamId ? { steamId: a.steamId } : {}),
      });
    }
    if (!cases.length) throw new ValidationError("No eval cases given.");
    const configs: Partial<Record<EvalPurpose, AiConfig>> = {};
    for (const p of PURPOSES) {
      const r = await this.configs.resolve(p);
      if (r.result.ok) configs[p] = r.result.config;
    }
    const verify = await this.configs.resolve("verify");
    const report = await runEval(cases, {
      configs,
      ...(verify.result.ok ? { verifier: verify.result.config } : {}),
      langs: request.langs?.length ? request.langs : ["pt"],
    });
    const id = await this.repository.saveEval({
      createdAt: report.createdAt,
      cases: report.cases,
      ...report.summary,
    });
    await this.audit.record(adminId, "ai.eval", {
      id,
      cases: report.cases,
      runs: report.summary.runs,
    });
    return { id, ...report };
  }
}
