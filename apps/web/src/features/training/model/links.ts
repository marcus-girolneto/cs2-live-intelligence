/**
 * The only links the training UI renders: steam:// (open the Workshop page, start CS2) and
 * https://steamcommunity.com pages. Anything else from the API is dropped.
 */
export function isSafeTrainingUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  if (/^steam:\/\/rungameid\/730$/.test(url)) return true;
  if (/^steam:\/\/url\/CommunityFilePage\/[0-9]{6,12}$/.test(url)) return true;
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      u.hostname === "steamcommunity.com" &&
      u.port === "" &&
      u.username === "" &&
      u.password === ""
    );
  } catch {
    return false;
  }
}
export const LAUNCH_CS2 = "steam://rungameid/730";
/** Console lines we let users copy: printable ASCII, no newlines, bounded. */
export const safeCommand = (value: unknown): string | null =>
  typeof value === "string" && /^[ -~]{1,200}$/.test(value) ? value : null;
