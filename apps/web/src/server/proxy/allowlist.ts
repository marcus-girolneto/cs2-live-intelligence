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
];
/** Routes that work without a session (the API decides what to return). */
export const PUBLIC_ROUTES = new Set(["auth/steam/start", "plans"]);
/** Query parameters forwarded per route, each with its value pattern (everything else is dropped). */
const INT = /^[0-9]{1,4}$/;
const SECONDS = /^[0-9]{1,4}(\.[0-9]{1,3})?$/;
const QUERY: [RegExp, Record<string, RegExp>][] = [
  [/^admin\/audit$/, { limit: INT }],
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
  /^analyses\/[A-Za-z0-9_-]+\/coaching$/.test(path);
export { MAX_DEMO_BYTES } from "@/shared/config/limits";
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
