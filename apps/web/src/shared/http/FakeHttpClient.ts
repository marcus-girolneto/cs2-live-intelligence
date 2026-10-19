import type { HttpClient, HttpMethod, RequestOptions } from "./HttpClient";

export type RecordedCall = {
  method: HttpMethod;
  path: string;
  options: RequestOptions;
};
type Handler = (call: RecordedCall) => unknown;

/** In-memory HttpClient for tests: route handlers by "METHOD path" and record calls. */
export class FakeHttpClient implements HttpClient {
  readonly calls: RecordedCall[] = [];
  private readonly routes = new Map<string, Handler>();

  on(method: HttpMethod, path: string, reply: unknown | Handler): this {
    this.routes.set(
      `${method} ${path}`,
      typeof reply === "function" ? (reply as Handler) : () => reply,
    );
    return this;
  }
  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const call = { method: options.method ?? "GET", path, options };
    this.calls.push(call);
    const handler = this.routes.get(`${call.method} ${path}`);
    if (!handler)
      throw new Error(`FakeHttpClient: no route ${call.method} ${path}`);
    return (await handler(call)) as T;
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
  delete<T>(path: string, options?: Omit<RequestOptions, "method">) {
    return this.request<T>(path, { ...options, method: "DELETE" });
  }
}
