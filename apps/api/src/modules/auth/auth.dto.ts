import { z } from "zod";

/** POST /v1/auth/exchange body. */
export const exchangeRequestSchema = z.object({ code: z.string().max(128) });
export type ExchangeRequestDto = z.infer<typeof exchangeRequestSchema>;
export type ExchangeResponseDto = { token: string };
export type SteamStartResponseDto = { url: string };
