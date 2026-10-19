import type { AccountPlanView, AdminPlanView, PlanView } from "./plans.dto.js";
import type { FastifyRequest } from "fastify";
import { NotFoundError } from "../../shared/errors/index.js";
import { ownerOf } from "../../shared/http/principal.js";
import { describeIssues, parseDto } from "../../shared/http/validation.js";
import {
  planGrantSchema,
  planIdSchema,
  planUpdateSchema,
} from "./plans.dto.js";
import type { PlansService } from "./plans.service.js";

const INVALID = { code: "invalid_request" } as const;

/** HTTP ⇄ plans service: parses DTOs and shapes responses (guards run as preHandlers). */
export class PlansController {
  constructor(
    private readonly plans: PlansService,
    private readonly uploads?: { maxDemoBytes(): Promise<number> },
  ) {}

  /** Public catalogue plus the demo upload limit (same for every plan). */
  list = async (): Promise<{
    plans: PlanView[];
    uploads?: { maxDemoBytes: number };
  }> => ({
    plans: await this.plans.publicPlans(),
    ...(this.uploads
      ? { uploads: { maxDemoBytes: await this.uploads.maxDemoBytes() } }
      : {}),
  });

  adminList = async (): Promise<{ plans: AdminPlanView[] }> => ({
    plans: await this.plans.adminPlans(),
  });

  /** PUT /v1/admin/plans takes the id in the body; PUT /v1/admin/plans/:id in the path. */
  adminUpdate = async (request: FastifyRequest): Promise<AdminPlanView> => {
    const params = request.params as { id?: string };
    const { id: bodyId, ...body } = {
      ...((request.body as object | null) ?? {}),
    } as Record<string, unknown>;
    const id = params.id ?? bodyId;
    if (!planIdSchema.safeParse(id).success)
      throw new NotFoundError("Plan not found", { code: "not_found" });
    const patch = parseDto(
      planUpdateSchema,
      body,
      (e) => `Invalid plan: ${describeIssues(e, 3)}`,
      INVALID,
    );
    return this.plans.updatePlan(ownerOf(request), id as string, patch);
  };

  grant = async (
    request: FastifyRequest<{ Params: { id: string } }>,
  ): Promise<{ userId: string; plan: AccountPlanView }> => {
    const grant = parseDto(
      planGrantSchema,
      request.body,
      (e) => `Invalid grant: ${describeIssues(e, 3)}`,
      INVALID,
    );
    const { id } = request.params;
    return {
      userId: id,
      plan: await this.plans.grant(ownerOf(request), id, grant),
    };
  };
}
