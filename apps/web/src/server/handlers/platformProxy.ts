import { apiUrl, json, ownerToken, sameOrigin } from "../session";
import {
  AI_PROXY_TIMEOUT_MS,
  allowedProxy,
  forwardQuery,
  isAiRoute,
  cappedBody,
  PUBLIC_ROUTES,
  MAX_DEMO_BYTES,
} from "../proxy/allowlist";
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
  try {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (upload) {
      headers["Content-Type"] = "application/octet-stream";
      headers["x-filename"] = request.headers.get("x-filename") ?? "";
    } else if (request.method !== "GET" && request.method !== "DELETE")
      headers["Content-Type"] = "application/json";
    const body =
      request.method === "GET" || request.method === "DELETE"
        ? undefined
        : await cappedBody(request, upload ? MAX_DEMO_BYTES : 8192);
    const upstream = await fetch(
      `${apiUrl()}/v1/${path}${request.method === "GET" ? forwardQuery(path, new URL(request.url).searchParams) : ""}`,
      {
        method: request.method,
        headers,
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(
          upload ? 120000 : isAiRoute(path) ? AI_PROXY_TIMEOUT_MS : 10000,
        ),
        redirect: "error",
      },
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
      error instanceof Error && error.message === "Payload too large";
    return json(
      {
        error: tooLarge
          ? upload
            ? "Demo exceeds the 64 MiB upload limit."
            : "Request body is too large."
          : "Service unavailable. Please try again.",
      },
      tooLarge ? 413 : 502,
    );
  }
}
export { proxy as GET, proxy as POST, proxy as PUT, proxy as DELETE };
