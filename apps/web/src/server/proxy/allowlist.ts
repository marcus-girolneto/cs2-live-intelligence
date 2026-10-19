const routes: [string, RegExp][] = [
  ["GET", /^me$/],
  ["GET", /^live\/sessions$/],
  ["GET", /^settings$/],
  ["PUT", /^settings$/],
  ["GET", /^devices$/],
  ["POST", /^devices\/pair$/],
  ["POST", /^devices\/[A-Za-z0-9_-]+\/rotate$/],
  ["DELETE", /^devices\/[A-Za-z0-9_-]+$/],
  ["DELETE", /^account$/],
  ["POST", /^demos\/uploads$/],
  ["GET", /^matches$/],
  ["GET", /^matches\/[A-Za-z0-9_-]+$/],
  ["GET", /^analyses\/[A-Za-z0-9_-]+$/],
  ["POST", /^analyses\/[A-Za-z0-9_-]+\/coaching$/],
  // Stored reviews per tier (compare Quick vs Deep) and the match reel (Pro).
  ["GET", /^analyses\/[A-Za-z0-9_-]+\/reviews$/],
  ["GET", /^analyses\/[A-Za-z0-9_-]+\/reel$/],
  // Credits: ledger, packs and pack checkout.
  ["GET", /^credits\/ledger$/],
  ["GET", /^credits\/packs$/],
  ["POST", /^billing\/credits\/checkout$/],
  // Monthly performance reports (Pro).
  ["GET", /^reports$/],
  ["GET", /^reports\/[A-Za-z0-9_-]+$/],
  ["POST", /^reports\/generate$/],
  // Personal Coach (Pro): one plan from all matches.
  ["GET", /^coach\/personal$/],
  ["POST", /^coach\/personal\/generate$/],
  // 2D replay for clips ("cortes").
  ["GET", /^analyses\/[A-Za-z0-9_-]+\/replay\/meta$/],
  ["GET", /^analyses\/[A-Za-z0-9_-]+\/replay$/],
  // Plans, usage and billing (the Stripe webhook goes to the API directly, never via here).
  ["GET", /^plans$/],
  ["GET", /^billing\/status$/],
  ["POST", /^billing\/checkout$/],
  ["POST", /^billing\/portal$/],
  ["GET", /^ai\/status$/],
  ["POST", /^ai\/live-call$/],
  ["GET", /^coach\/profile$/],
  ["PUT", /^coach\/profile$/],
  ["GET", /^coach\/progress$/],
  ["POST", /^coach\/reviews\/[A-Za-z0-9_-]+\/rating$/],
  ["GET", /^demos\/sample$/],
  ["POST", /^demos\/sample$/],
  ["POST", /^ai\/test$/],
  ["POST", /^admin\/ai\/test$/],
  ["POST", /^feedback$/],
  ["GET", /^auth\/steam\/start$/],
  ["POST", /^me\/refresh-profile$/],
  // Admin area (the API answers 403 to non-admins).
  ["GET", /^admin\/ai\/providers$/],
  ["POST", /^admin\/ai\/providers$/],
  ["PUT", /^admin\/ai\/providers\/[A-Za-z0-9_-]+$/],
  ["DELETE", /^admin\/ai\/providers\/[A-Za-z0-9_-]+$/],
  ["POST", /^admin\/ai\/providers\/[A-Za-z0-9_-]+\/test$/],
  ["GET", /^admin\/ai\/providers\/[A-Za-z0-9_-]+\/models$/],
  ["GET", /^admin\/ai\/assignments$/],
  ["PUT", /^admin\/ai\/assignments$/],
  ["GET", /^admin\/settings$/],
  ["PUT", /^admin\/settings$/],
  ["GET", /^admin\/users$/],
  ["PUT", /^admin\/users\/[A-Za-z0-9_-]+\/role$/],
  ["GET", /^admin\/audit$/],
  ["POST", /^admin\/analyses\/reprocess$/],
  ["GET", /^admin\/plans$/],
  ["PUT", /^admin\/plans$/],
  ["PUT", /^admin\/users\/[A-Za-z0-9_-]+\/plan$/],
  ["GET", /^admin\/credits\/settings$/],
  ["PUT", /^admin\/credits\/settings$/],
  ["GET", /^admin\/credits\/packs$/],
  ["PUT", /^admin\/credits\/packs$/],
  ["GET", /^admin\/users\/[A-Za-z0-9_-]+\/ledger$/],
  ["POST", /^admin\/users\/[A-Za-z0-9_-]+\/credits$/],
];
/** Routes that work without a session (the API decides what to return). */
export const PUBLIC_ROUTES = new Set([
  "auth/steam/start",
  "plans",
  "credits/packs",
]);
/** Query parameters forwarded per route, each with its value pattern (everything else is dropped). */
const INT = /^[0-9]{1,4}$/;
const SECONDS = /^[0-9]{1,4}(\.[0-9]{1,3})?$/;
const PLAYER = /^[A-Za-z0-9_-]{1,32}$/;
const QUERY: [RegExp, Record<string, RegExp>][] = [
  [/^admin\/audit$/, { limit: INT }],
  [/^credits\/ledger$/, { limit: INT }],
  [/^admin\/users\/[A-Za-z0-9_-]+\/ledger$/, { limit: INT }],
  [/^analyses\/[A-Za-z0-9_-]+\/(reviews|reel)$/, { steamId: PLAYER }],
  [
    /^analyses\/[A-Za-z0-9_-]+\/replay$/,
    { round: INT, from: SECONDS, to: SECONDS },
  ],
];
export function forwardQuery(path: string, search: URLSearchParams) {
  const allowed = QUERY.find(([route]) => route.test(path))?.[1];
  if (!allowed) return "";
  const out = new URLSearchParams();
  for (const [key, pattern] of Object.entries(allowed)) {
    const value = search.get(key);
    if (value !== null && pattern.test(value)) out.set(key, value);
  }
  const q = out.toString();
  return q ? `?${q}` : "";
}
export function allowedProxy(method: string, path: string) {
  return routes.some(([verb, regex]) => method === verb && regex.test(path));
}
/** AI calls can take minutes on large models; the API enforces AI_TIMEOUT_MS itself. */
export const AI_PROXY_TIMEOUT_MS = 10 * 60 * 1000;
export const isAiRoute = (path: string) =>
  path.startsWith("ai/") ||
  path.startsWith("admin/ai/") ||
  path === "reports/generate" ||
  path === "coach/personal/generate" ||
  /^analyses\/[A-Za-z0-9_-]+\/coaching$/.test(path);
export { MAX_DEMO_BYTES } from "@/shared/config/limits";
/**
 * Streams the request body through unchanged while counting bytes: never buffers the
 * upload in memory, and errors the stream as soon as `limit` is exceeded. A declared
 * Content-Length above the limit is rejected before reading anything.
 */
export function cappedStream(request: Request, limit: number) {
  const length = request.headers.get("content-length");
  if (length && Number(length) > limit) throw new Error("Payload too large");
  let size = 0;
  let exceeded = false;
  const counter = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      size += chunk.byteLength;
      if (size > limit) {
        exceeded = true;
        controller.error(new Error("Payload too large"));
        return;
      }
      controller.enqueue(chunk);
    },
  });
  return {
    body: request.body ? request.body.pipeThrough(counter) : null,
    /** True once the stream was cut for going over the limit. */
    exceeded: () => exceeded,
  };
}

/** Reads a small body (JSON) fully, rejecting anything above `limit`. */
export async function cappedBody(request: Request, limit: number) {
  const length = request.headers.get("content-length");
  if (length && Number(length) > limit) throw new Error("Payload too large");
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        throw new Error("Payload too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
