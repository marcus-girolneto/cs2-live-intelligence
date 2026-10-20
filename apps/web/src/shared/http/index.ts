// The only module that talks to the network (enforced by lint). Feature api/ files
export { ApiError, isApiError } from "./ApiError";
export {
  FetchHttpClient,
  platformHttp,
  seg,
  webHttp,
  withQuery,
  type HttpClient,
  type HttpClientConfig,
  type HttpMethod,
  type Query,
  type RequestOptions,
} from "./HttpClient";
export { ensureLocalSession } from "./localSession";
export {
  platformUploader,
  XhrUploader,
  type Uploader,
  type UploadOptions,
  type UploadProgress,
} from "./Uploader";
export { aiErrorText, type AiTask } from "./aiError";
