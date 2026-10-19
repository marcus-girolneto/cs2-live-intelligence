import type { AnalysisResult } from "@/features/analysis";
import type { MatchDto, MatchListDto, SettingsDto } from "@/shared/api-types";
import {
  platformHttp,
  platformUploader,
  seg,
  type HttpClient,
  type UploadProgress,
  type Uploader,
} from "@/shared/http";

/** Demo uploads, match list/status, the public sample demo, consent and feedback. */
export interface MatchesApi {
  listMatches(): Promise<MatchDto[]>;
  getMatch(id: string): Promise<MatchDto>;
  getAnalysis(analysisId: string): Promise<AnalysisResult>;
  getSettings(): Promise<SettingsDto>;
  saveSettings(settings: SettingsDto): Promise<SettingsDto>;
  sampleAvailable(): Promise<boolean>;
  importSample(): Promise<{ id: string }>;
  /** Raw .dem upload (octet-stream with the file name in a header). */
  /** Streams the demo to the API with real progress; abort via `signal`. */
  uploadDemo(
    file: File,
    options?: {
      signal?: AbortSignal;
      onProgress?: (p: UploadProgress) => void;
    },
  ): Promise<{ id: string }>;
  sendFeedback(rating: number, comment: string): Promise<void>;
}

export function createMatchesApi(
  http: HttpClient = platformHttp,
  uploader: Uploader = platformUploader,
): MatchesApi {
  return {
    listMatches: () => http.get<MatchListDto>("matches").then((r) => r.matches),
    getMatch: (id) => http.get<MatchDto>(`matches/${seg(id)}`),
    getAnalysis: (analysisId) =>
      http.get<AnalysisResult>(`analyses/${seg(analysisId)}`),
    getSettings: () => http.get<SettingsDto>("settings"),
    saveSettings: (settings) => http.put<SettingsDto>("settings", settings),
    sampleAvailable: () =>
      http.get<{ available: boolean }>("demos/sample").then((r) => r.available),
    importSample: () => http.post<{ id: string }>("demos/sample", {}),
    uploadDemo: (file, options = {}) =>
      uploader.upload<{ id: string }>("demos/uploads", file, {
        headers: {
          "Content-Type": "application/octet-stream",
          "x-filename": file.name,
        },
        ...options,
      }),
    sendFeedback: async (rating, comment) => {
      await http.post("feedback", { rating, comment });
    },
  };
}
export const matchesApi = createMatchesApi();
