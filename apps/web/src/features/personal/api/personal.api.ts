import { platformHttp, type HttpClient } from "@/shared/http";
import { normalizePersonal, type PersonalState } from "../model/personal";

/** Writing the plan reads every match — a long AI call. */
const AI_TIMEOUT = 10 * 60 * 1000;

/** Personal Coach (Pro): a general plan built from all of the player's matches. */
export interface PersonalApi {
  get(): Promise<PersonalState>;
  /** Writes a new plan; 402 plan_required for non-Pro accounts. */
  generate(): Promise<PersonalState>;
}

export function createPersonalApi(
  http: HttpClient = platformHttp,
): PersonalApi {
  return {
    get: async () =>
      normalizePersonal(await http.get<unknown>("coach/personal")),
    generate: async () =>
      normalizePersonal(
        await http.post<unknown>(
          "coach/personal/generate",
          {},
          { timeoutMs: AI_TIMEOUT },
        ),
      ),
  };
}

export const personalApi = createPersonalApi();
