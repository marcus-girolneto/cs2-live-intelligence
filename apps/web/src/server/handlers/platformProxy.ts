import { apiUrl, json, ownerToken, sameOrigin } from "../session";
import {
  AI_PROXY_TIMEOUT_MS,
  allowedProxy,
  forwardQuery,
  isAiRoute,
  cappedBody,
  cappedStream,
  PUBLIC_ROUTES,
  MAX_DEMO_BYTES,
} from "../proxy/allowlist";
/** A 500 MB demo on a slow uplink can take a while. */
const UPLOAD_TIMEOUT_MS = 30 * 60 * 1000;
type Context = { params: Promise<{ path: string[] }> };
async function proxy(request: Request, context: Context) {
  if (!sameOrigin(request)) return json({ error: "Origin not allowed" }, 403);
  const { path: segments } = await context.params;
  const path = segments.join("/");
  if (!allowedProxy(request.method, path))
    return json({ error: "Route not found" }, 404);
  const publicRoute = PUBLIC_ROUTES.has(path);
  const setsCookies = path === "auth/steam/start";
  const token = await ownerToken();
  if (!publicRoute && !token)
    return json({ error: "Sign in to continue." }, 401);
  const upload = path === "demos/uploads";
  let streamed: ReturnType<typeof cappedStream> | null = null;
  try {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (upload) {
      headers["Content-Type"] = "application/octet-stream";
      headers["x-filename"] = request.headers.get("x-filename") ?? "";
    } else if (request.method !== "GET" && request.method !== "DELETE")
      headers["Content-Type"] = "application/json";
    // Demos (up to MAX_DEMO_BYTES) are streamed through, never buffered in memory.
    if (upload) streamed = cappedStream(request, MAX_DEMO_BYTES);
    const body = upload
      ? streamed?.body
      : request.method === "GET" || request.method === "DELETE"
        ? undefined
        : await cappedBody(request, 8192);
    const upstream = await fetch(
      `${apiUrl()}/v1/${path}${request.method === "GET" ? forwardQuery(path, new URL(request.url).searchParams) : ""}`,
      {
        method: request.method,
        headers,
        body,
        // Required by fetch to send a ReadableStream body.
        ...(upload ? { duplex: "half" } : {}),
        cache: "no-store",
        signal: AbortSignal.timeout(
          upload
            ? UPLOAD_TIMEOUT_MS
            : isAiRoute(path)
              ? AI_PROXY_TIMEOUT_MS
              : 10000,
        ),
        redirect: "error",
      } as RequestInit,
    );
    const response = new Response(
      upstream.status === 204 ? null : await upstream.text(),
      {
        status: upstream.status,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      },
    );
    if (setsCookies)
      for (const cookie of upstream.headers.getSetCookie())
        response.headers.append("Set-Cookie", cookie);
    return response;
  } catch (error) {
    const tooLarge =
      streamed?.exceeded() ||
      (error instanceof Error &&
        (error.message === "Payload too large" ||
          (error.cause instanceof Error &&
            error.cause.message === "Payload too large")));
    return json(
      {
        error: tooLarge
          ? upload
            ? "Demo exceeds the 500 MB upload limit."
            : "Request body is too large."
          : "Service unavailable. Please try again.",
      },
      tooLarge ? 413 : 502,
    );
  }
}
export { proxy as GET, proxy as POST, proxy as PUT, proxy as DELETE };
