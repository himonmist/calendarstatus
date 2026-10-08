import { formatInTimeZone } from "date-fns-tz";
import { weekdayOf, utcToZonedParts } from "./time";
import type { Booking } from "./booking/types";

const ACTIVE = ["pending", "confirmed", "rescheduled"];
const DELIVERED = ["confirmed", "completed"];

export function buildAnalytics(all: Booking[], o: { now: Date; timezone: string; from?: Date; to?: Date }) {
  const tz = o.timezone;
  const bs = all.filter(b => (!o.from || b.start >= o.from) && (!o.to || b.start <= o.to));
  const count = (pred: (b: Booking) => boolean) => bs.filter(pred).length;
  const total = bs.length;
  const today = utcToZonedParts(o.now, tz).date;
  const hours = bs.filter(b => DELIVERED.includes(b.status)).reduce((s, b) => s + (b.end.getTime() - b.start.getTime()) / 3_600_000, 0);

  const tally = <K extends string>(key: (b: Booking) => K | undefined) => {
    const m: Record<string, number> = {};
    for (const b of bs) { const k = key(b); if (k) m[k] = (m[k] ?? 0) + 1; }
    return m;
  };
  const byProgramMap = new Map<string, { title: string; count: number }>();
  for (const b of bs) { const e = byProgramMap.get(b.programId) ?? { title: b.programTitle, count: 0 }; e.count++; byProgramMap.set(b.programId, e); }
  const byWeekday = Array<number>(7).fill(0);
  for (const b of bs) byWeekday[weekdayOf(utcToZonedParts(b.start, tz).date, tz)]++;
  const monthMap = tally(b => formatInTimeZone(b.start, tz, "yyyy-MM"));

  return {
    kpis: {
      total, confirmed: count(b => b.status === "confirmed"), pending: count(b => b.status === "pending"),
      cancelled: count(b => b.status === "cancelled"),
      cancellationRate: total ? count(b => b.status === "cancelled") / total : 0,
      leadConversion: total ? count(b => DELIVERED.includes(b.status)) / total : 0,
      organizations: new Set(bs.map(b => b.organization.toLowerCase())).size,
      customers: new Set(bs.map(b => b.email)).size,
      participants: bs.filter(b => DELIVERED.includes(b.status)).reduce((s, b) => s + b.participants, 0),
      trainingHours: Math.round(hours * 10) / 10,
      todaysBookings: count(b => ACTIVE.includes(b.status) && utcToZonedParts(b.start, tz).date === today),
      upcoming: count(b => ACTIVE.includes(b.status) && b.start > o.now),
    },
    byMonth: Object.keys(monthMap).sort().map(month => ({ month, count: monthMap[month] })),
    byProgram: [...byProgramMap.values()].sort((a, b) => b.count - a.count),
    byStatus: tally(b => b.status), byIndustry: tally(b => b.industry), byFormat: tally(b => b.format),
    byLeadSource: tally(b => b.leadSource), byWeekday,
    byHour: tally(b => formatInTimeZone(b.start, tz, "HH:00")),
  };
}
