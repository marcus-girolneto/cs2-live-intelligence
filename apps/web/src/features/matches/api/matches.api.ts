import type { AnalysisResult } from "@/features/analysis";
import type { MatchDto, MatchListDto, SettingsDto } from "@/shared/api-types";
import {
  normalizeAutoReviews,
  normalizeOwnership,
  type AutoReview,
  type OwnershipKind,
  type Ownership,
} from "../model/ownership";
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
  /** Whether you played in each demo (job ids). */
  getOwnership(ids: string[]): Promise<Map<string, Ownership>>;
  /** Marks a demo as yours (optionally as a given player) or as someone else's. */
  setOwnership(
    id: string,
    ownership: OwnershipKind,
    playerSteamId?: string,
  ): Promise<void>;
  /** Auto-review state per demo (job ids). */
  getAutoReviews(ids: string[]): Promise<Map<string, AutoReview>>;
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
    getOwnership: async (ids) =>
      ids.length
        ? normalizeOwnership(
            await http.get(
              `matches/ownership?ids=${ids.map(encodeURIComponent).join(",")}`,
            ),
          )
        : new Map(),
    setOwnership: async (id, ownership, playerSteamId) => {
      await http.patch(`matches/${seg(id)}/ownership`, {
        ownership,
        ...(playerSteamId ? { playerSteamId } : {}),
      });
    },
    getAutoReviews: async (ids) =>
      ids.length
        ? normalizeAutoReviews(
            await http.get(
              `matches/auto-reviews?ids=${ids.map(encodeURIComponent).join(",")}`,
            ),
          )
        : new Map(),
  };
}
export const matchesApi = createMatchesApi();
