/** Outcome of a live credential check (never contains the credential). */
export type ProbeResult = {
  ok: boolean;
  latencyMs: number;
  detail: string;
  livemode?: boolean;
};

/** Port: live checks of third-party credentials for the admin "Test" buttons. */
export interface IntegrationProbes {
  /** Steam Web API ISteamUser/GetPlayerSummaries for one SteamID64. */
  steam(apiKey: string, steamId: string): Promise<ProbeResult>;
  /** Stripe GET /v1/balance (read-only, works with restricted keys that can read balance). */
  stripe(secretKey: string): Promise<ProbeResult>;
}

const TIMEOUT_MS = 8000;
const redact = (text: string, secret: string): string =>
  (secret ? text.replaceAll(secret, "[redacted]") : text).slice(0, 200);

/** Adapter over fetch. Errors are summarized; URLs (Steam puts the key in the query) never leak. */
export class HttpIntegrationProbes implements IntegrationProbes {
  constructor(
    private readonly fetchImpl?: typeof fetch,
    private readonly now: () => number = () => performance.now(),
  ) {}

  async steam(apiKey: string, steamId: string): Promise<ProbeResult> {
    const url = new URL(
      "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/",
    );
    url.searchParams.set("key", apiKey);
    url.searchParams.set("steamids", steamId);
    return this.run(apiKey, url.toString(), {}, async (response) => {
      if (response.status === 401 || response.status === 403)
        return { ok: false, detail: "Steam rejected the key (HTTP 403)." };
      if (!response.ok)
        return { ok: false, detail: `Steam answered HTTP ${response.status}.` };
      const body = (await response.json().catch(() => ({}))) as {
        response?: { players?: unknown[] };
      };
      const found = body.response?.players?.length ?? 0;
      return found
        ? { ok: true, detail: "Key accepted; profile summary returned." }
        : {
            ok: true,
            detail: "Key accepted; no public summary for this SteamID.",
          };
    });
  }

  async stripe(secretKey: string): Promise<ProbeResult> {
    return this.run(
      secretKey,
      "https://api.stripe.com/v1/balance",
      { authorization: `Bearer ${secretKey}` },
      async (response) => {
        const body = (await response.json().catch(() => ({}))) as {
          livemode?: unknown;
          error?: { message?: unknown };
        };
        if (!response.ok)
          return {
            ok: false,
            detail: redact(
              `Stripe answered HTTP ${response.status}${
                typeof body.error?.message === "string"
                  ? `: ${body.error.message}`
                  : "."
              }`,
              secretKey,
            ),
          };
        return {
          ok: true,
          detail: "Key accepted.",
          ...(typeof body.livemode === "boolean"
            ? { livemode: body.livemode }
            : {}),
        };
      },
    );
  }

  private async run(
    secret: string,
    url: string,
    headers: Record<string, string>,
    read: (response: Response) => Promise<Omit<ProbeResult, "latencyMs">>,
  ): Promise<ProbeResult> {
    const started = this.now();
    const elapsed = (): number => Math.max(0, Math.round(this.now() - started));
    let response: Response;
    try {
      response = await (this.fetchImpl ?? fetch)(url, {
        headers: { accept: "application/json", ...headers },
        redirect: "error",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      return {
        ok: false,
        latencyMs: elapsed(),
        detail: "Unreachable or timed out.",
      };
    }
    try {
      const result = await read(response);
      return {
        ...result,
        detail: redact(result.detail, secret),
        latencyMs: elapsed(),
      };
    } catch {
      return {
        ok: false,
        latencyMs: elapsed(),
        detail: "Unreadable response.",
      };
    }
  }
}
