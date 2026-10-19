import { ApiError } from "./ApiError";
import { ensureLocalSession } from "./localSession";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type Query = Record<string, string | number | undefined>;

export type RequestOptions = {
  method?: HttpMethod;
  /** JSON body (serialised with a JSON content type). */
  json?: unknown;
  /** Raw body (e.g. a demo file); sent as-is. */
  body?: BodyInit;
  headers?: Record<string, string>;
  query?: Query;
  /** Caller-controlled cancellation; replaces the default timeout when given. */
  signal?: AbortSignal;
  /** Timeout used when no signal is given (default: the client's timeout). */
  timeoutMs?: number;
};

/** The single HTTP abstraction every feature API depends on (fakes implement it in tests). */
export interface HttpClient {
  request<T>(path: string, options?: RequestOptions): Promise<T>;
  get<T>(path: string, options?: Omit<RequestOptions, "method">): Promise<T>;
  post<T>(
    path: string,
    json?: unknown,
    options?: Omit<RequestOptions, "method" | "json">,
  ): Promise<T>;
  put<T>(
    path: string,
    json?: unknown,
    options?: Omit<RequestOptions, "method" | "json">,
  ): Promise<T>;
  patch<T>(
    path: string,
    json?: unknown,
    options?: Omit<RequestOptions, "method" | "json">,
  ): Promise<T>;
  delete<T>(path: string, options?: Omit<RequestOptions, "method">): Promise<T>;
}

export type HttpClientConfig = {
  /** Path prefix, e.g. "/api/platform" (the same-origin proxy) or "/api" (web routes). */
  basePath: string;
  timeoutMs?: number;
  /** On 401, try the local demo session once and replay the request. */
  retryWithLocalSession?: boolean;
  fetchImpl?: typeof fetch;
};

type ErrorBody = {
  error?: string;
  message?: string;
  code?: string;
  missing?: string[];
};

export function withQuery(path: string, query?: Query): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (value !== undefined) params.set(key, String(value));
  const q = params.toString();
  return q ? `${path}${path.includes("?") ? "&" : "?"}${q}` : path;
}

/** fetch wrapper: base path, JSON in/out, no-store, timeouts/abort and typed ApiError. */
export class FetchHttpClient implements HttpClient {
  private readonly timeoutMs: number;
  constructor(private readonly config: HttpClientConfig) {
    this.timeoutMs = config.timeoutMs ?? 20000;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const doFetch = this.config.fetchImpl ?? fetch;
    const headers: Record<string, string> = { ...options.headers };
    let body = options.body;
    if (options.json !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.json);
    }
    const url = `${this.config.basePath}/${withQuery(path, options.query)}`;
    const send = () =>
      doFetch(url, {
        method: options.method ?? "GET",
        ...(Object.keys(headers).length ? { headers } : {}),
        ...(body !== undefined ? { body } : {}),
        cache: "no-store",
        signal:
          options.signal ??
          AbortSignal.timeout(options.timeoutMs ?? this.timeoutMs),
      });
    let response = await send();
    if (
      response.status === 401 &&
      this.config.retryWithLocalSession &&
      !(body instanceof ReadableStream)
    ) {
      if (await ensureLocalSession()) response = await send();
    }
    if (response.status === 204) return undefined as T;
    const result = (await response.json().catch(() => ({}))) as T & ErrorBody;
    if (!response.ok)
      throw new ApiError(
        result.error ??
          result.message ??
          `Request failed (${response.status}).`,
        response.status,
        result.code,
        result.missing,
        result as Record<string, unknown>,
      );
    return result;
  }
  get<T>(path: string, options?: Omit<RequestOptions, "method">) {
    return this.request<T>(path, { ...options, method: "GET" });
  }
  post<T>(
    path: string,
    json?: unknown,
    options?: Omit<RequestOptions, "method" | "json">,
  ) {
    return this.request<T>(path, { ...options, method: "POST", json });
  }
  put<T>(
    path: string,
    json?: unknown,
    options?: Omit<RequestOptions, "method" | "json">,
  ) {
    return this.request<T>(path, { ...options, method: "PUT", json });
  }
  patch<T>(
    path: string,
    json?: unknown,
    options?: Omit<RequestOptions, "method" | "json">,
  ) {
    return this.request<T>(path, { ...options, method: "PATCH", json });
  }
  delete<T>(path: string, options?: Omit<RequestOptions, "method">) {
    return this.request<T>(path, { ...options, method: "DELETE" });
  }
}

/** Platform API through the same-origin proxy (app/api/platform → src/server/proxy). */
export const platformHttp: HttpClient = new FetchHttpClient({
  basePath: "/api/platform",
  retryWithLocalSession: true,
});
/** The web app's own route handlers (session, logout, live ticket, simulator). */
export const webHttp: HttpClient = new FetchHttpClient({ basePath: "/api" });

/** Path segment helper: every id interpolated into a path goes through here. */
export const seg = (value: string) => encodeURIComponent(value);
