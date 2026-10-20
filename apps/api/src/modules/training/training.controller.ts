import type { FastifyRequest } from "fastify";
import { ownerOf } from "../../shared/http/principal.js";
import { parseDto } from "../../shared/http/validation.js";
import {
  trainingQuerySchema,
  type AnalysisTrainingDto,
  type RecommendedTrainingDto,
  type TrainingCatalogDto,
} from "./training.dto.js";
import type { TrainingService } from "./training.service.js";

type ById = FastifyRequest<{ Params: { id: string } }>;

/** Practice catalog, per-match training plans and recommendations. */
export class TrainingController {
  constructor(private readonly training: TrainingService) {}

  /** GET /v1/training/catalog. */
  catalog = async (): Promise<TrainingCatalogDto> => this.training.catalog();

  /** GET /v1/analyses/:id/training?steamId= (owner only). */
  forAnalysis = async (request: ById): Promise<AnalysisTrainingDto> => {
    const query = parseDto(
      trainingQuerySchema,
      request.query ?? {},
      "Invalid player",
    );
    return this.training.forAnalysis(
      ownerOf(request),
      request.params.id,
      query.steamId,
    );
  };

  /** GET /v1/training/recommended. */
  recommended = async (
    request: FastifyRequest,
  ): Promise<RecommendedTrainingDto> =>
    this.training.recommended(ownerOf(request));
}
