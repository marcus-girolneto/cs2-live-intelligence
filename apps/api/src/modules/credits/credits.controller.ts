import type { FastifyRequest } from "fastify";
import { NotFoundError } from "../../shared/errors/index.js";
import { ownerOf } from "../../shared/http/principal.js";
import { describeIssues, parseDto } from "../../shared/http/validation.js";
import type { CreditSettingsService } from "./credit-settings.service.js";
import {
  adjustRequestSchema,
  creditSettingsPatchSchema,
  ledgerQuerySchema,
  packsUpdateSchema,
  type AdminPackView,
  type CreditSettings,
  type LedgerDto,
  type PackView,
} from "./credits.dto.js";
import type { CreditsService } from "./credits.service.js";

const INVALID = { code: "invalid_request" } as const;
type ById = FastifyRequest<{ Params: { id: string } }>;
const limitOf = (request: FastifyRequest): number =>
  parseDto(
    ledgerQuerySchema,
    request.query ?? {},
    "limit must be 1 to 200",
    INVALID,
  ).limit;

/** Wallet ledger, packs, and the admin credit settings / packs / adjustments. */
export class CreditsController {
  constructor(
    private readonly credits: CreditsService,
    private readonly settings: CreditSettingsService,
  ) {}

  ledger = async (request: FastifyRequest): Promise<LedgerDto> =>
    this.credits.ledger(ownerOf(request), limitOf(request));

  packs = async (): Promise<{ packs: PackView[] }> => ({
    packs: await this.settings.packs(),
  });

  adminSettings = async (): Promise<{ settings: CreditSettings }> => ({
    settings: await this.settings.settings(),
  });

  updateSettings = async (
    request: FastifyRequest,
  ): Promise<{ settings: CreditSettings }> => {
    const patch = parseDto(
      creditSettingsPatchSchema,
      request.body ?? {},
      (e) => `Invalid credit settings: ${describeIssues(e, 3)}`,
      INVALID,
    );
    return this.settings.update(ownerOf(request), patch);
  };

  adminPacks = async (): Promise<{ packs: AdminPackView[] }> =>
    this.settings.adminPacks();

  updatePacks = async (
    request: FastifyRequest,
  ): Promise<{ packs: AdminPackView[] }> => {
    const body = parseDto(
      packsUpdateSchema,
      request.body,
      (e) => `Invalid packs: ${describeIssues(e, 3)}`,
      INVALID,
    );
    return this.settings.savePacks(ownerOf(request), body.packs);
  };

  userLedger = async (
    request: ById,
  ): Promise<LedgerDto & { userId: string }> => {
    const { id } = request.params;
    if (!id || id.length > 128)
      throw new NotFoundError("User not found", { code: "not_found" });
    return { userId: id, ...(await this.credits.ledger(id, limitOf(request))) };
  };

  adjust = async (request: ById): Promise<Record<string, unknown>> => {
    const body = parseDto(
      adjustRequestSchema,
      request.body,
      (e) => `Invalid adjustment: ${describeIssues(e, 3)}`,
      INVALID,
    );
    return this.credits.adjust(ownerOf(request), request.params.id, body);
  };
}
