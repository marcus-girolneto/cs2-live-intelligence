// DTOs of the platform API (published by the backend in @cs2/contracts). Feature api/
// modules type their requests and responses with these; components use view models.
import type { api } from "@cs2/contracts";

export type MatchDto = api.MatchDto;
export type MatchListDto = api.MatchListDto;
export type QueuedJobDto = api.QueuedJobDto;
export type SampleAvailabilityDto = api.SampleAvailabilityDto;
export type StoredAnalysisDto = api.StoredAnalysisDto;
export type MeDto = api.MeDto;
export type Role = api.Role;
export type SteamProfileDto = api.SteamProfileDto;
export type RefreshThrottledDto = api.RefreshThrottledDto;
export type DeviceDto = api.DeviceDto;
export type DeviceListDto = api.DeviceListDto;
export type PairingCodeDto = api.PairingCodeDto;
export type CoachProfileDto = api.CoachProfileDto;
export type CoachProgressDto = api.CoachProgressDto;
export type ProgressPointDto = api.ProgressPointDto;
export type ReviewSummaryDto = api.ReviewSummaryDto;
export type PlayerReviewDto = api.PlayerReviewDto;
export type PlanItemDto = api.PlanItemDto;
export type MapProgressDto = api.MapProgressDto;
export type LiveCallDto = api.LiveCallDto;
export type AiStatusDto = api.AiStatusDto;
export type AiPurposeStatusDto = api.AiPurposeStatusDto;
export type AiErrorDto = api.AiErrorDto;
export type AiPurpose = api.AiPurpose;
export type AdminUserDto = api.AdminUserDto;
export type AuditEntryDto = api.AuditEntryDto;
export type AssignmentMapDto = api.AssignmentMapDto;
export type ProviderViewDto = api.ProviderViewDto;
export type AppSettingsViewDto = api.AppSettingsViewDto;
export type PlanView = api.PlanView;
export type AdminPlanView = api.AdminPlanView;
export type AccountPlanView = api.AccountPlanView;
export type UsageView = api.UsageView;
export type PlanLimitErrorDto = api.PlanLimitErrorDto;
export type BillingStatusDto = api.BillingStatusDto;
export type RedirectDto = api.RedirectDto;
export type ReplayMetaDto = api.ReplayMetaDto;
export type ReplayWindowDto = api.ReplayWindowDto;

/** Live session list item (GET /v1/live/sessions). */
export type LiveSessionDto = {
  sessionId: string;
  map?: string;
  phase?: string;
  receivedAt: string;
  sequence: number;
};
/** Consent and retention settings (GET/PUT /v1/settings). */
export type SettingsDto = {
  telemetryConsent: boolean;
  analyticsConsent: boolean;
  retentionDays: number;
};
