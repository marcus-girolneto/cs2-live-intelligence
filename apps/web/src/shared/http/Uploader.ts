import { ApiError } from "./ApiError";
import { ensureLocalSession } from "./localSession";

export type UploadProgress = { loaded: number; total: number };
export type UploadOptions = {
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Called as bytes leave the browser (real network progress). */
  onProgress?: (p: UploadProgress) => void;
};

/** Large-file uploads with progress events (fetch can't report upload progress). */
export interface Uploader {
  upload<T>(path: string, body: Blob, options?: UploadOptions): Promise<T>;
}

const abortError = () => new DOMException("Upload cancelled.", "AbortError");

/** XMLHttpRequest uploader against a same-origin base path (e.g. the platform proxy). */
export class XhrUploader implements Uploader {
  constructor(
    private readonly basePath: string,
    private readonly retryWithLocalSession = true,
  ) {}

  async upload<T>(path: string, body: Blob, options: UploadOptions = {}) {
    try {
      return await this.send<T>(path, body, options);
    } catch (e) {
      if (
        e instanceof ApiError &&
        e.status === 401 &&
        this.retryWithLocalSession &&
        (await ensureLocalSession())
      )
        return this.send<T>(path, body, options);
      throw e;
    }
  }

  private send<T>(path: string, body: Blob, options: UploadOptions) {
    return new Promise<T>((resolve, reject) => {
      if (options.signal?.aborted) return reject(abortError());
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${this.basePath}/${path}`);
      for (const [k, v] of Object.entries(options.headers ?? {}))
        xhr.setRequestHeader(k, v);
      xhr.upload.onprogress = (e) =>
        options.onProgress?.({
          loaded: e.loaded,
          total: e.lengthComputable ? e.total : body.size,
        });
      const onAbort = () => xhr.abort();
      options.signal?.addEventListener("abort", onAbort, { once: true });
      const done = () => options.signal?.removeEventListener("abort", onAbort);
      xhr.onabort = () => {
        done();
        reject(abortError());
      };
      xhr.onerror = () => {
        done();
        reject(new ApiError("Network error during upload.", 0));
      };
      xhr.onload = () => {
        done();
        let result: Record<string, unknown> = {};
        try {
          result = xhr.responseText
            ? (JSON.parse(xhr.responseText) as Record<string, unknown>)
            : {};
        } catch {
          /* non-JSON error page */
        }
        if (xhr.status >= 200 && xhr.status < 300) return resolve(result as T);
        const text = (k: string) =>
          typeof result[k] === "string" ? (result[k] as string) : undefined;
        reject(
          new ApiError(
            text("error") ??
              text("message") ??
              `Request failed (${xhr.status}).`,
            xhr.status,
            text("code"),
            Array.isArray(result.missing)
              ? (result.missing as string[])
              : undefined,
            result,
          ),
        );
      };
      xhr.send(body);
    });
  }
}

export const platformUploader: Uploader = new XhrUploader("/api/platform");
