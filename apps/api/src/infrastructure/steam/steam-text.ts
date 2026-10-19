import type { PersonaState } from "./steam-profile.types.js";

export const CS2_APP_ID = 730;
export const MAX_BODY = 512 * 1024;
export const TIMEOUT_MS = 5000;
export const SUMMARY_MAX = 2000;
export const steamIdPattern = /^[0-9]{17}$/;

/** https only, Steam CDN hosts only. */
export function safeImageUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 512) return undefined;
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || url.port)
      return undefined;
    return host === "steamstatic.com" ||
      host.endsWith(".steamstatic.com") ||
      host === "steamcdn-a.akamaihd.net"
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}
/** Only https://steamcommunity.com/id/... or /profiles/... */
export function safeProfileUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 256) return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" &&
      url.hostname === "steamcommunity.com" &&
      !url.username &&
      !url.password &&
      !url.port &&
      /^\/(id\/[A-Za-z0-9_-]{1,64}|profiles\/[0-9]{17})\/?$/.test(url.pathname)
      ? `https://steamcommunity.com${url.pathname}`
      : undefined;
  } catch {
    return undefined;
  }
}

const named: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  "#39": "'",
};
/** Decodes predefined and numeric character references once; never expands custom entities. */
export function decodeEntities(text: string): string {
  return text.replace(
    /&(#x[0-9a-f]{1,6}|#[0-9]{1,7}|[a-z]{2,6}|#39);/gi,
    (m, e: string) => {
      const lower = e.toLowerCase();
      if (lower in named) return named[lower]!;
      if (lower.startsWith("#")) {
        const code = lower.startsWith("#x")
          ? parseInt(lower.slice(2), 16)
          : parseInt(lower.slice(1), 10);
        if (
          Number.isInteger(code) &&
          code > 0 &&
          code <= 0x10ffff &&
          !(code >= 0xd800 && code <= 0xdfff)
        )
          return String.fromCodePoint(code);
        return "";
      }
      return m;
    },
  );
}
// C0/C1 controls except tab/newline, plus bidi overrides and zero-width tricks.
export const unsafeChars =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]/g;
/** Single-line display text, clamped. */
export function cleanText(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.replace(unsafeChars, "").replace(/\s+/g, " ").trim();
  return text ? [...text].slice(0, max).join("") : undefined;
}
/** Steam bio (HTML) → plain text. Never returns markup. */
export function htmlToText(
  html: unknown,
  max = SUMMARY_MAX,
): string | undefined {
  if (typeof html !== "string") return undefined;
  let text = html
    .slice(0, 64 * 1024)
    .replace(
      /<(script|style|iframe|object|embed|template)\b[\s\S]*?(<\/\1\s*>|$)/gi,
      "",
    )
    .replace(/<!--[\s\S]*?(-->|$)/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|blockquote)\s*>/gi, "\n")
    .replace(/<[^>]*>?/g, "");
  text = decodeEntities(text)
    // Decoded "&lt;tag&gt;" must not come back as markup.
    .replace(/<\/?[a-z!?][^>]*>?/gi, "")
    .replace(/[<>]/g, "")
    .replace(unsafeChars, "")
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!text || /^no information given\.?$/i.test(text)) return undefined;
  const chars = [...text];
  return chars.length > max
    ? chars
        .slice(0, max - 1)
        .join("")
        .trimEnd() + "…"
    : text;
}

export const int = (value: unknown, min = 0, max = 1e9): number | undefined => {
  const n =
    typeof value === "string" && value.trim()
      ? Number(value.replace(/,/g, ""))
      : value;
  return typeof n === "number" && Number.isFinite(n) && n >= min && n <= max
    ? Math.floor(n)
    : undefined;
};
export const hours = (minutes: unknown): number | undefined => {
  const m = int(minutes, 0, 1e9);
  return m === undefined ? undefined : Math.round((m / 60) * 10) / 10;
};
export const unixIso = (seconds: unknown): string | undefined => {
  const s = int(seconds, 1, 4102444800); // ..2100
  return s === undefined ? undefined : new Date(s * 1000).toISOString();
};
const months = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
/** "October 12, 2010" → ISO (UTC midnight). */
export function parseMemberSince(text: unknown): string | undefined {
  if (typeof text !== "string") return undefined;
  const m = /^\s*([A-Za-z]+)\s+([0-9]{1,2}),\s*([0-9]{4})\s*$/.exec(text);
  if (!m) return undefined;
  const month = months.indexOf(m[1]!.toLowerCase());
  const day = Number(m[2]);
  const year = Number(m[3]);
  if (month < 0 || day < 1 || day > 31 || year < 2003 || year > 2100)
    return undefined;
  const date = new Date(Date.UTC(year, month, day));
  return date.getUTCDate() === day ? date.toISOString() : undefined;
}

/** Persona states of the Web API, indexed by `personastate`. */
export const personaStates: PersonaState[] = [
  "offline",
  "online",
  "busy",
  "away",
  "snooze",
  "looking to trade",
  "looking to play",
];
type Json = Record<string, unknown>;
export const obj = (v: unknown): Json =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Json) : {};
export const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Reads a response body, refusing more than `max` bytes. */
export async function readCapped(
  response: Response,
  max = MAX_BODY,
): Promise<string> {
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > max) throw new Error("Steam response too large");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => undefined);
      throw new Error("Steam response too large");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
