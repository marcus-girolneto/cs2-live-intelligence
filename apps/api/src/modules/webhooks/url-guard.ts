import { isIP } from "node:net";
import { ValidationError } from "../../shared/errors/index.js";
import {
  isBlockedAddress,
  isLoopbackHost,
} from "../../shared/net/address-policy.js";

export type UrlPolicy = {
  /** Local development (APP_ENV=local): http://localhost and private addresses are allowed. */
  allowPrivateNetworks: boolean;
};

const invalid = (message: string): ValidationError =>
  new ValidationError(message, { code: "invalid_webhook_url" });

/**
 * Static checks of a webhook URL when it is registered: https only (http only to localhost in
 * local mode), no credentials, no fragments, and no literal IP in a private, loopback,
 * link-local or metadata range. Hostnames are resolved and checked again on every delivery.
 */
export function checkWebhookUrl(raw: string, policy: UrlPolicy): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw invalid("Webhook URL must be an absolute https URL");
  }
  const local = policy.allowPrivateNetworks && isLoopbackHost(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local))
    throw invalid(
      policy.allowPrivateNetworks
        ? "Webhook URL must use https (http is allowed only for localhost in local mode)"
        : "Webhook URL must use https",
    );
  if (url.username || url.password)
    throw invalid("Webhook URL must not contain credentials");
  if (url.hash) throw invalid("Webhook URL must not contain a fragment");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!policy.allowPrivateNetworks) {
    if (isLoopbackHost(host) || host.endsWith(".internal"))
      throw invalid("Webhook URL must point to a public host");
    if (isIP(host) && isBlockedAddress(host))
      throw invalid("Webhook URL must point to a public address");
  }
  return url;
}
