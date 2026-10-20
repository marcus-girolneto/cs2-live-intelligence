// Registry of every PT dictionary (shared + one per feature), merged once.
import { i18nPt as admin } from "@/features/admin";
import { i18nPt as analysis } from "@/features/analysis";
import { i18nPt as auth } from "@/features/auth";
import { i18nPt as billing } from "@/features/billing";
import { i18nPt as coach } from "@/features/coach";
import { i18nPt as dashboard } from "@/features/dashboard";
import { i18nPt as developers } from "@/features/developers";
import { i18nPt as landing } from "@/features/landing";
import { i18nPt as live } from "@/features/live";
import { i18nPt as maps } from "@/features/maps";
import { i18nPt as matches } from "@/features/matches";
import { i18nPt as privacy } from "@/features/privacy";
import { i18nPt as progress } from "@/features/progress";
import { i18nPt as replay } from "@/features/replay";
import { i18nPt as personal } from "@/features/personal";
import { i18nPt as reports } from "@/features/reports";
import { i18nPt as settings } from "@/features/settings";
import { i18nPt as shell } from "@/features/shell";
import { i18nPt as training } from "@/features/training";
import type { Dictionaries } from "@/shared/i18n";
import { mergeDictionaries } from "@/shared/i18n/core";
import { pt as shared } from "@/shared/i18n/pt";

export const ptParts = {
  shared,
  admin,
  analysis,
  auth,
  billing,
  coach,
  dashboard,
  developers,
  landing,
  live,
  maps,
  matches,
  privacy,
  progress,
  replay,
  personal,
  reports,
  settings,
  shell,
  training,
};
const merged = mergeDictionaries(ptParts);
/** Keys translated differently by two parts (must stay empty; see i18n.test.ts). */
export const ptConflicts = merged.conflicts;
export const dictionaries: Dictionaries = { en: {}, pt: merged.merged };
