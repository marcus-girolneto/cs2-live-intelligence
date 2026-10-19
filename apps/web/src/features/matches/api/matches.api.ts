import type { AnalysisResult } from "@/features/analysis";
import type { MatchDto, MatchListDto, SettingsDto } from "@/shared/api-types";
import { platformHttp, seg, type HttpClient } from "@/shared/http";

const UPLOAD_TIMEOUT_MS = 120000;

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
  uploadDemo(file: File): Promise<{ id: string }>;
  sendFeedback(rating: number, comment: string): Promise<void>;
}

export function createMatchesApi(http: HttpClient = platformHttp): MatchesApi {
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
    uploadDemo: (file) =>
      http.request<{ id: string }>("demos/uploads", {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "x-filename": file.name,
        },
        body: file,
        timeoutMs: UPLOAD_TIMEOUT_MS,
      }),
    sendFeedback: async (rating, comment) => {
      await http.post("feedback", { rating, comment });
    },
  };
}
export const matchesApi = createMatchesApi();
