import { fromZonedTime, toZonedTime, formatInTimeZone } from "date-fns-tz";

export interface Interval { start: Date; end: Date }

/** Wall-clock date ("YYYY-MM-DD") + time ("HH:mm") in a zone -> UTC instant. */
export function zonedToUtc(date: string, time: string, tz: string): Date {
  return fromZonedTime(`${date}T${time}:00`, tz);
}

export function utcToZonedParts(d: Date, tz: string) {
  return { date: formatInTimeZone(d, tz, "yyyy-MM-dd"), time: formatInTimeZone(d, tz, "HH:mm") };
}

export function weekdayOf(date: string, tz: string): number {
  // 0 = Sunday .. 6 = Saturday, evaluated in the given zone
  return toZonedTime(zonedToUtc(date, "12:00", tz), tz).getDay();
}

export const addMinutes = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);

/** Half-open interval overlap: touching intervals do not overlap. */
export const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

export function formatRange(i: Interval, tz: string) {
  return `${formatInTimeZone(i.start, tz, "h:mm a")} – ${formatInTimeZone(i.end, tz, "h:mm a")}`;
}
