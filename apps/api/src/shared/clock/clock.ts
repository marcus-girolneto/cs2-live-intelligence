/** Time source and the app's billing/quota day (local calendar day in APP_TIMEZONE). */
export interface Clock {
  now(): Date;
  /** Calendar day (YYYY-MM-DD) of `at` in the app time zone. */
  day(at?: Date): string;
  /** Next local midnight after `at`, as an ISO instant. */
  nextMidnight(at?: Date): string;
  readonly timeZone: string;
}

export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

export function validTimeZone(zone: string | undefined): string {
  if (!zone?.trim()) return DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone.trim() });
    return zone.trim();
  } catch {
    console.warn(
      `APP_TIMEZONE "${zone}" is not a valid IANA zone; using ${DEFAULT_TIMEZONE}.`,
    );
    return DEFAULT_TIMEZONE;
  }
}

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function parts(zone: string, at: Date): DateParts {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}
/** Offset (ms) of `zone` from UTC at instant `at`. */
function offset(zone: string, at: Date): number {
  const p = parts(zone, at);
  const asUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

export class ZonedClock implements Clock {
  readonly timeZone: string;
  constructor(
    timeZone?: string,
    private readonly source: () => number = Date.now,
  ) {
    this.timeZone = validTimeZone(timeZone);
  }
  now(): Date {
    return new Date(this.source());
  }
  day(at = this.now()): string {
    const p = parts(this.timeZone, at);
    return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
  }
  nextMidnight(at = this.now()): string {
    const p = parts(this.timeZone, at);
    const localMidnight = Date.UTC(p.year, p.month - 1, p.day + 1);
    // Two passes settle DST transitions around midnight.
    let guess = localMidnight - offset(this.timeZone, new Date(localMidnight));
    guess = localMidnight - offset(this.timeZone, new Date(guess));
    return new Date(guess).toISOString();
  }
}

/** Millisecond time source (Date.now in production; fixed in tests). */
export type TimeSource = () => number;
