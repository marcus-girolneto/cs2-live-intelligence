import type { Clock } from "../../shared/clock/clock.js";

/** A monthly credit period [start, end). */
export type CreditPeriod = { start: string; end: string };

const HOUR = 3_600_000;
/** `at` moved by whole months in UTC, clamping the day (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(at: Date, months: number): Date {
  const d = new Date(at.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

/**
 * The credit period containing `now`.
 * - With an anchor (a Stripe subscription's current_period_end): monthly windows ending on the
 *   anchor's day/time, so yearly subscriptions also get monthly grants.
 * - Without one (admin-granted plans): the calendar month in the app time zone.
 * `limit` (a subscription end) cuts the period short.
 */
export function creditPeriod(
  now: Date,
  clock: Clock,
  anchor: string | null,
  limit: string | null = null,
): CreditPeriod {
  let start: Date;
  let end: Date;
  if (anchor) {
    // k months from the anchor (no cumulative day clamping): start ≤ now < end.
    const base = new Date(anchor);
    let k =
      (now.getUTCFullYear() - base.getUTCFullYear()) * 12 +
      (now.getUTCMonth() - base.getUTCMonth());
    while (addMonths(base, k).getTime() <= now.getTime()) k++;
    while (addMonths(base, k - 1).getTime() > now.getTime()) k--;
    end = addMonths(base, k);
    start = addMonths(base, k - 1);
  } else {
    const [y, m] = clock.day(now).split("-").map(Number) as [number, number];
    // Local midnight of the 1st: step through local midnights from two days before.
    const firstOf = (year: number, month: number): Date => {
      const target = `${year}-${String(month).padStart(2, "0")}-01`;
      let at = new Date(Date.UTC(year, month - 1, 1) - 30 * HOUR);
      for (let i = 0; i < 4; i++) {
        at = new Date(clock.nextMidnight(at));
        if (clock.day(at) === target) return at;
      }
      return new Date(Date.UTC(year, month - 1, 1));
    };
    start = firstOf(y, m);
    end = firstOf(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1);
  }
  if (
    limit &&
    Date.parse(limit) < end.getTime() &&
    Date.parse(limit) > now.getTime()
  )
    end = new Date(limit);
  return { start: start.toISOString(), end: end.toISOString() };
}
