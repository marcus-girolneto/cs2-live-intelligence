import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { request as httpRequest, type RequestOptions } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP, type LookupFunction } from "node:net";
import { isBlockedAddress } from "../../shared/net/address-policy.js";

/** Result of one outbound POST. */
export type TransportResult = { status: number | null; error: string | null };

/** Port: sends one signed webhook request. */
export interface WebhookTransport {
  post(
    url: string,
    body: string,
    headers: Record<string, string>,
  ): Promise<TransportResult>;
}

export class BlockedAddressError extends Error {}

/**
 * DNS lookup that resolves every address of the host and refuses the request when ANY of them
 * is in a blocked range. The socket then connects to the address checked here, so DNS
 * rebinding between the check and the connection is not possible.
 */
export function guardedLookup(allowPrivate: boolean): LookupFunction {
  return (hostname, options, callback) => {
    dnsLookup(hostname, { all: true }, (error, addresses: LookupAddress[]) => {
      if (error) return callback(error, "", 0);
      const list = addresses ?? [];
      if (!list.length)
        return callback(new Error("Host did not resolve"), "", 0);
      if (!allowPrivate && list.some((a) => isBlockedAddress(a.address)))
        return callback(
          new BlockedAddressError("Host resolves to a blocked address"),
          "",
          0,
        );
      if ((options as { all?: boolean }).all)
        return (callback as unknown as (e: null, a: LookupAddress[]) => void)(
          null,
          list,
        );
      callback(null, list[0]!.address, list[0]!.family);
    });
  };
}

/**
 * node:http(s) POST with the guarded lookup, a hard timeout, no redirects (3xx counts as a
 * failure), no connection reuse, and at most 4 KiB of the response read and discarded.
 */
export class HttpWebhookTransport implements WebhookTransport {
  constructor(
    private readonly options: { allowPrivate: boolean; timeoutMs?: number },
  ) {}

  post(
    url: string,
    body: string,
    headers: Record<string, string>,
  ): Promise<TransportResult> {
    const target = new URL(url);
    // Literal IPs never go through the lookup: check them here.
    const literal = target.hostname.replace(/^\[|\]$/g, "");
    if (
      !this.options.allowPrivate &&
      isIP(literal) &&
      isBlockedAddress(literal)
    )
      return Promise.resolve({ status: null, error: "Blocked address" });
    const send = target.protocol === "https:" ? httpsRequest : httpRequest;
    const options: RequestOptions = {
      method: "POST",
      headers: {
        ...headers,
        "content-type": "application/json",
        "content-length": String(Buffer.byteLength(body)),
        "user-agent": "FragMind-Webhooks/1",
      },
      lookup: guardedLookup(this.options.allowPrivate),
      timeout: this.options.timeoutMs ?? 10_000,
      agent: false,
    };
    return new Promise((resolve) => {
      let settled = false;
      const done = (result: TransportResult) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      const req = send(target, options, (res) => {
        let read = 0;
        res.on("data", (chunk: Buffer) => {
          read += chunk.length;
          if (read > 4096) res.destroy();
        });
        const status = res.statusCode ?? null;
        const finish = () =>
          done({
            status,
            error:
              status !== null && status >= 200 && status < 300
                ? null
                : `HTTP ${status}`,
          });
        res.on("end", finish);
        res.on("close", finish);
        res.on("error", finish);
      });
      req.on("timeout", () => req.destroy(new Error("Timed out")));
      req.on("error", (error) =>
        done({
          status: null,
          error:
            error instanceof BlockedAddressError
              ? "Blocked address"
              : error.message.slice(0, 200),
        }),
      );
      req.end(body);
    });
  }
}
