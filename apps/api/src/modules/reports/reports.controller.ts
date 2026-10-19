import type { FastifyRequest } from "fastify";
import type { AuthGuards } from "../../shared/http/guards.js";
import { ownerOf } from "../../shared/http/principal.js";
import { langSchema } from "../coaching/coaching.dto.js";
import type {
  ReportDto,
  ReportSummaryDto,
  ReportsService,
} from "./reports.service.js";

/** GET /v1/reports, GET /v1/reports/:id, POST /v1/reports/generate. */
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly guards: AuthGuards,
  ) {}

  list = async (
    request: FastifyRequest,
  ): Promise<{ reports: ReportSummaryDto[] }> =>
    this.reports.list(ownerOf(request));

  get = async (
    request: FastifyRequest<{ Params: { id: string } }>,
  ): Promise<ReportDto> => {
    const ownerId = ownerOf(request);
    return this.reports.get(
      ownerId,
      request.params.id,
      await this.guards.isAdmin(ownerId),
    );
  };

  generate = async (
    request: FastifyRequest<{ Body: { lang?: unknown } | null }>,
  ): Promise<ReportDto> =>
    this.reports.generate(
      ownerOf(request),
      langSchema.parse(request.body?.lang),
    );
}
