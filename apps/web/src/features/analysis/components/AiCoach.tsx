"use client";
import { CoachPreview, useSavedReview } from "@/features/coach";
/** AI Coach tab of the match analysis: a compact preview that opens the /coach screen. */
export function AiCoach({
  analysisId,
  steamId,
  name,
}: {
  analysisId: string;
  steamId: string;
  name: string;
}) {
  const review = useSavedReview(analysisId, steamId);
  const href = `/coach?match=${encodeURIComponent(analysisId)}&player=${encodeURIComponent(steamId)}`;
  return <CoachPreview href={href} name={name} review={review} />;
}
