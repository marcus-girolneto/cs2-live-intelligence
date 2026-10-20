import { prettifyCallouts } from "@cs2/contracts/callouts";
import { text } from "./format";

/**
 * Model-written text for display: trimmed (null when empty) and with raw demo callouts made
 * readable ("TopofMid" → "Top of Mid") for reviews saved before the server did it.
 */
export function prose(value: unknown): string | null {
  const s = text(value);
  return s === null ? null : prettifyCallouts(s);
}
