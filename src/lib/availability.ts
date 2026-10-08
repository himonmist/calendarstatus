import { addMinutes, overlaps, weekdayOf, zonedToUtc, type Interval } from "./time";

export type DayHours = { start: string; end: string } | null;

export interface AvailabilityConfig {
  timezone: string;
  /** 0 = Sunday … 6 = Saturday; null = closed. */
  weekly: Record<number, DayHours>;
  blockedDates: string[]; // YYYY-MM-DD in `timezone`
  durationMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  stepMin: number;
  minNoticeHours: number;
  maxAdvanceDays: number;
}

export interface Conflicts {
  busy: Interval[];     // external calendar (Google)
  bookings: Interval[]; // confirmed/pending bookings in our DB
  holds: Interval[];    // unexpired temporary reservations
  now: Date;
}

/** Public-safe slot: deliberately has no reason / source fields. */
export interface Slot { start: Date; end: Date; available: boolean }

export type DayStatus = "available" | "limited" | "busy" | "unavailable";

export function computeDaySlots(date: string, cfg: AvailabilityConfig, c: Conflicts): Slot[] {
  if (cfg.blockedDates.includes(date)) return [];
  const hours = cfg.weekly[weekdayOf(date, cfg.timezone)];
  if (!hours) return [];

  const dayStart = zonedToUtc(date, hours.start, cfg.timezone);
  const dayEnd = zonedToUtc(date, hours.end, cfg.timezone);
  const earliest = addMinutes(c.now, cfg.minNoticeHours * 60);
  const latest = addMinutes(c.now, cfg.maxAdvanceDays * 24 * 60);
  const blockers = [...c.busy, ...c.bookings, ...c.holds];

  const slots: Slot[] = [];
  for (let s = dayStart; addMinutes(s, cfg.durationMin) <= dayEnd; s = addMinutes(s, cfg.stepMin)) {
    const end = addMinutes(s, cfg.durationMin);
    if (s > latest) break;
    const padded = { start: addMinutes(s, -cfg.bufferBeforeMin), end: addMinutes(end, cfg.bufferAfterMin) };
    const available = s >= earliest && !blockers.some(b => overlaps(padded, b));
    slots.push({ start: s, end, available });
  }
  return slots;
}

/** True only if this exact slot is currently bookable. Used for re-validation before confirming. */
export function isSlotAvailable(slot: Interval, cfg: AvailabilityConfig, c: Conflicts, date: string): boolean {
  const slots = computeDaySlots(date, cfg, c);
  return slots.some(s => s.available && s.start.getTime() === slot.start.getTime() && s.end.getTime() === slot.end.getTime());
}

export function summarizeDay(date: string, cfg: AvailabilityConfig, c: Conflicts): DayStatus {
  const slots = computeDaySlots(date, cfg, c);
  if (slots.length === 0) return "unavailable";
  const free = slots.filter(s => s.available).length;
  if (free === 0) return "busy";
  return free <= 3 ? "limited" : "available";
}
