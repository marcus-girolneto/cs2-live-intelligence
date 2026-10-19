import type { ExchangeResponseDto, SteamStartResponseDto } from "./auth.dto.js";
import type { FastifyReply, FastifyRequest } from "fastify";
import { AppError, ValidationError } from "../../shared/errors/index.js";
import {
  clearedCookie,
  readCookie,
  sessionCookie,
} from "../../shared/http/cookies.js";
import { bearerToken, ownerOf } from "../../shared/http/principal.js";
import { exchangeRequestSchema } from "./auth.dto.js";
import type { AuthService } from "./auth.service.js";

const STATE_COOKIE = "cs2_steam_state";
const EXCHANGE_COOKIE = "cs2_steam_exchange";

/** HTTP ⇄ AuthService: cookies, redirects and no-store headers live here. */
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly webOrigin: string,
    private readonly apiPublicUrl: string,
  ) {}

  private get secure(): boolean {
    return this.apiPublicUrl.startsWith("https:");
  }

  logout = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<FastifyReply> => {
    await this.auth.logout(bearerToken(request), ownerOf(request));
    return reply.code(204).send();
  };

  start = async (
    _request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<SteamStartResponseDto> => {
    const { state, url } = await this.auth.startSteamLogin();
    reply.header("cache-control", "no-store");
    reply.header(
      "set-cookie",
      sessionCookie(STATE_COOKIE, state, 600, this.secure),
    );
    return { url };
  };

  callback = async (
    request: FastifyRequest<{ Querystring: Record<string, string> }>,
    reply: FastifyReply,
  ): Promise<FastifyReply> => {
    reply.header("cache-control", "no-store");
    reply.header("set-cookie", clearedCookie(STATE_COOKIE));
    const query = request.query;
    if (Object.values(query).some((value) => typeof value !== "string"))
      throw new ValidationError("Invalid OpenID response");
    const result = await this.auth.completeSteamLogin(
      query,
      readCookie(request, STATE_COOKIE),
      request.ip,
    );
    if (result.status === "unavailable")
      throw new AppError(502, "Steam verification unavailable");
    if (result.status === "rejected")
      throw new ValidationError("Steam authentication rejected");
    const destination = new URL("/auth/callback", this.webOrigin);
    destination.searchParams.set("code", result.code);
    reply.header("set-cookie", [
      clearedCookie(STATE_COOKIE),
      sessionCookie(EXCHANGE_COOKIE, result.binding, 60, this.secure),
    ]);
    return reply.redirect(destination.toString());
  };

  exchange = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<ExchangeResponseDto> => {
    const body = exchangeRequestSchema.safeParse(request.body);
    if (!body.success) throw new ValidationError("Invalid code");
    const binding = readCookie(request, EXCHANGE_COOKIE) ?? "";
    if (!binding || binding.length > 128)
      throw new ValidationError("Invalid exchange binding");
    const result = await this.auth.exchange(body.data.code, binding);
    reply.header("set-cookie", clearedCookie(EXCHANGE_COOKIE));
    reply.header("cache-control", "no-store");
    if (!result) throw new ValidationError("Expired or consumed code");
    return result;
  };
}
