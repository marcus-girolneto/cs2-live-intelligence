import {
  AI_PURPOSES,
  type AssignmentMap,
  type ProviderViewDto,
} from "./ai-config.dto.js";
import type { AiProviderRecord } from "./ai-config.repository.js";

/** Stored provider → admin view: options flattened, secrets reduced to flags and last 4. */
export function providerView(
  row: AiProviderRecord,
  assigned: AssignmentMap,
): ProviderViewDto {
  const o = row.options;
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    baseUrl: row.baseUrl,
    apiStyle: o.apiStyle ?? null,
    jsonMode: o.jsonMode ?? null,
    maxTokensParam: o.maxTokensParam ?? null,
    maxOutputTokens: o.maxOutputTokens ?? null,
    timeoutMs: o.timeoutMs ?? null,
    maxAttempts: o.maxAttempts ?? null,
    temperature: o.temperature ?? null,
    extraBody: o.extraBody ?? {},
    allowHttp: o.allowHttp === true,
    headerNames: row.headerNames,
    keyConfigured: !!row.apiKeyEnc,
    keyLast4: row.apiKeyEnc ? row.keyLast4 : null,
    assignedTo: AI_PURPOSES.filter((p) => assigned[p]?.providerId === row.id),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
