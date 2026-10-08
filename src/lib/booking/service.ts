import { createHash, randomBytes, randomUUID } from "node:crypto";
import { computeDaySlots, isSlotAvailable, summarizeDay, type AvailabilityConfig, type DayStatus, type Slot } from "../availability";
import { addMinutes, utcToZonedParts, type Interval } from "../time";
import type { BookingInput } from "../validation";
import type { Booking, BookingStatus, BusyBlock, CalendarProvider, NotifyEvent, Program, Store } from "./types";

export class SlotUnavailableError extends Error {
  constructor() { super("This time slot was just booked or became unavailable. Please select another available time."); }
}
export class NotFoundError extends Error { constructor() { super("We couldn't find a booking matching those details."); } }
export class ValidationError extends Error {}
export class CancellationNotAllowedError extends Error {
  constructor() { super("This booking is within the cancellation window. Please contact the trainer directly."); }
}
export class CalendarUnavailableError extends Error {
  constructor() { super("We couldn't synchronize the calendar right now. Please try again shortly."); }
}

export interface ServiceDeps {
  store: Store; calendar: CalendarProvider; now: () => Date; autoConfirm: boolean | (() => Promise<boolean>);
  getConfig: () => Promise<AvailabilityConfig>;
  getProgram: (id: string) => Promise<Program | null>;
  notify: (e: NotifyEvent) => Promise<void>;
  holdTtlMs: number; cancellationDeadlineHours: number;
  busyTtlMs?: number; busyStaleMaxMs?: number;
}
interface Ctx { ip?: string; actor?: string }

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const DAY = 24 * 3600_000;

export class BookingService {
  private busyCache = new Map<string, { at: number; busy: BusyBlock[] }>();
  constructor(private d: ServiceDeps) {}

  // ---------- availability ----------
  private async busyFor(date: string, fresh: boolean): Promise<BusyBlock[]> {
    const cfg = await this.d.getConfig();
    const t = this.d.now().getTime();
    const hit = this.busyCache.get(date);
    if (!fresh && hit && t - hit.at < (this.d.busyTtlMs ?? 60_000)) return hit.busy;
    const day = new Date(`${date}T00:00:00Z`).getTime();
    const range = { start: new Date(day - 2 * DAY), end: new Date(day + 3 * DAY) };
    void cfg;
    try {
      const busy = (await this.d.calendar.getBusy(range)).filter(b => !b.managed);
      this.busyCache.set(date, { at: t, busy });
      return busy;
    } catch {
      if (!fresh && hit && t - hit.at < (this.d.busyStaleMaxMs ?? 15 * 60_000)) return hit.busy;
      throw new CalendarUnavailableError();
    }
  }

  /** One calendar round-trip for a whole month instead of one per day. */
  private async prefetchBusy(dates: string[]) {
    if (!dates.length) return;
    const t = this.d.now().getTime();
    const ttl = this.d.busyTtlMs ?? 60_000;
    if (dates.every(x => { const h = this.busyCache.get(x); return h && t - h.at < ttl; })) return;
    const first = new Date(`${dates[0]}T00:00:00Z`).getTime(), last = new Date(`${dates[dates.length - 1]}T00:00:00Z`).getTime();
    try {
      const busy = (await this.d.calendar.getBusy({ start: new Date(first - 2 * DAY), end: new Date(last + 3 * DAY) })).filter(b => !b.managed);
      for (const x of dates) this.busyCache.set(x, { at: t, busy });
    } catch { /* fall through: busyFor applies stale-cache / fail-closed rules per day */ }
  }

  private async conflicts(tx: Store, date: string, busy: BusyBlock[], opts: { excludeBookingId?: string; excludeHash?: string } = {}) {
    const day = new Date(`${date}T00:00:00Z`).getTime();
    const range = { start: new Date(day - 2 * DAY), end: new Date(day + 3 * DAY) };
    const now = this.d.now();
    const [bookings, holds] = await Promise.all([
      tx.listBlockingBookings(range, opts.excludeBookingId),
      tx.listActiveHolds(range, now, opts.excludeHash),
    ]);
    return { busy, bookings, holds, now };
  }

  private async cfgFor(p: Program): Promise<AvailabilityConfig> {
    return { ...(await this.d.getConfig()), durationMin: p.durationMin };
  }

  async getDay(date: string, programId: string): Promise<{ date: string; timezone: string; slots: Slot[] }> {
    const p = await this.activeProgram(programId);
    const cfg = await this.cfgFor(p);
    const busy = await this.busyFor(date, false);
    const c = await this.conflicts(this.d.store, date, busy);
    return { date, timezone: cfg.timezone, slots: computeDaySlots(date, cfg, c) };
  }

  async getMonth(dates: string[], programId: string): Promise<Record<string, DayStatus>> {
    const p = await this.activeProgram(programId);
    const cfg = await this.cfgFor(p);
    await this.prefetchBusy(dates);
    const out: Record<string, DayStatus> = {};
    for (const date of dates) {
      const busy = await this.busyFor(date, false);
      out[date] = summarizeDay(date, cfg, await this.conflicts(this.d.store, date, busy));
    }
    return out;
  }

  private async activeProgram(id: string) {
    const p = await this.d.getProgram(id);
    if (!p || !p.active) throw new ValidationError("Training program not found");
    return p;
  }

  // ---------- temporary reservation ----------
  async reserve(programId: string, start: Date): Promise<{ token: string; expiresAt: Date }> {
    const p = await this.activeProgram(programId);
    const cfg = await this.cfgFor(p);
    const date = utcToZonedParts(start, cfg.timezone).date;
    const slot = { start, end: addMinutes(start, p.durationMin) };
    const busy = await this.busyFor(date, false);
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(this.d.now().getTime() + this.d.holdTtlMs);
    await this.d.store.transaction(async tx => {
      await tx.purgeExpiredHolds(this.d.now());
      if (!isSlotAvailable(slot, cfg, await this.conflicts(tx, date, busy), date)) throw new SlotUnavailableError();
      await tx.insertHold({ tokenHash: sha(token), programId, ...slot, expiresAt });
    });
    return { token, expiresAt };
  }

  // ---------- booking ----------
  async createBooking(input: BookingInput, ctx: Ctx): Promise<Booking> {
    const p = await this.activeProgram(input.programId);
    if (input.participants < p.minParticipants || input.participants > p.maxParticipants)
      throw new ValidationError(`Number of participants must be between ${p.minParticipants} and ${p.maxParticipants} for this program`);
    const cfg = await this.cfgFor(p);
    const start = new Date(input.slotStart);
    const slot = { start, end: addMinutes(start, p.durationMin) };
    const date = utcToZonedParts(start, cfg.timezone).date;
    const hash = sha(input.holdToken);
    const busy = await this.busyFor(date, true); // always re-validate against live calendar
    const auto = typeof this.d.autoConfirm === "function" ? await this.d.autoConfirm() : this.d.autoConfirm;

    const booking = await this.d.store.transaction(async tx => {
      const hold = await tx.getHold(hash);
      const now = this.d.now();
      if (!hold || hold.expiresAt <= now || hold.programId !== p.id || hold.start.getTime() !== start.getTime())
        throw new SlotUnavailableError();
      if (!isSlotAvailable(slot, cfg, await this.conflicts(tx, date, busy, { excludeHash: hash }), date))
        throw new SlotUnavailableError();
      await tx.deleteHold(hash);
      const year = Number(utcToZonedParts(now, cfg.timezone).date.slice(0, 4));
      const seq = await tx.nextSequence(year);
      const b: Booking = {
        id: randomUUID(), reference: `TRN-${year}-${String(seq).padStart(5, "0")}`,
        programId: p.id, programTitle: p.title, ...slot, timezone: cfg.timezone, status: "pending",
        fullName: input.fullName, email: input.email, phone: input.phone, organization: input.organization,
        designation: input.designation, country: input.country, city: input.city, industry: input.industry,
        organizationType: input.organizationType, experienceLevel: input.experienceLevel,
        participants: input.participants, format: input.format, location: input.location,
        budgetRange: input.budgetRange, notes: input.notes, leadSource: input.leadSource,
        createdAt: now, updatedAt: now, history: [{ status: "pending", at: now, actor: ctx.ip ? `customer@${ctx.ip}` : "customer" }],
      };
      if (auto) { b.status = "confirmed"; b.history.push({ status: "confirmed", at: now, actor: "system", note: "auto-confirmed" }); }
      await tx.insertBooking(b);
      return b;
    });

    if (booking.status === "confirmed") await this.syncCreate(booking);
    await this.safeNotify({ type: "booking_received", booking });
    await this.safeNotify({ type: "admin_new_booking", booking });
    if (booking.status === "confirmed") await this.safeNotify({ type: "booking_confirmed", booking });
    return booking;
  }

  private eventInput(b: Booking) {
    return {
      title: `AI Training — ${b.organization}`,
      description: [
        `Training Program:\n${b.programTitle}`, `Organization:\n${b.organization}`, `Participants:\n${b.participants}`,
        `Contact:\n${b.fullName}\n${b.email}\n${b.phone}`, `Format:\n${b.format}`, `Booking Reference:\n${b.reference}`,
      ].join("\n\n"),
      start: b.start, end: b.end, timezone: b.timezone, attendeeEmail: b.email,
    };
  }

  private async syncCreate(b: Booking) {
    try {
      b.calendarEventId = await this.d.calendar.createEvent(this.eventInput(b));
      b.syncError = undefined;
    } catch (e) { b.syncError = "Google Calendar event could not be created"; }
    b.updatedAt = this.d.now();
    await this.d.store.updateBooking(b);
  }

  private async safeNotify(e: NotifyEvent) { try { await this.d.notify(e); } catch { /* never fail a booking on email errors */ } }

  // ---------- customer self-service ----------
  async lookup(reference: string, email: string): Promise<Booking> {
    const b = await this.d.store.getBookingByRef(reference.trim().toUpperCase());
    if (!b || b.email !== email.trim().toLowerCase()) throw new NotFoundError();
    return b;
  }

  async cancel(reference: string, email: string, ctx: Ctx): Promise<Booking> {
    const b = await this.lookup(reference, email);
    if (!["pending", "confirmed", "rescheduled"].includes(b.status)) throw new ValidationError("This booking can no longer be cancelled");
    if (b.start.getTime() - this.d.now().getTime() < this.d.cancellationDeadlineHours * 3600_000) throw new CancellationNotAllowedError();
    return this.transition(b, "cancelled", ctx.ip ? `customer@${ctx.ip}` : "customer", "booking_cancelled");
  }

  async reschedule(reference: string, email: string, newStart: Date, ctx: Ctx): Promise<Booking> {
    const existing = await this.lookup(reference, email);
    if (!["pending", "confirmed", "rescheduled"].includes(existing.status)) throw new ValidationError("This booking can no longer be rescheduled");
    const p = await this.activeProgram(existing.programId);
    const cfg = await this.cfgFor(p);
    const date = utcToZonedParts(newStart, cfg.timezone).date;
    const slot = { start: newStart, end: addMinutes(newStart, p.durationMin) };
    const busy = await this.busyFor(date, true);
    const updated = await this.d.store.transaction(async tx => {
      const b = (await tx.getBooking(existing.id))!;
      if (!isSlotAvailable(slot, cfg, await this.conflicts(tx, date, busy, { excludeBookingId: b.id }), date)) throw new SlotUnavailableError();
      const now = this.d.now();
      b.start = slot.start; b.end = slot.end; b.updatedAt = now;
      b.history.push({ status: b.status, at: now, actor: ctx.ip ? `customer@${ctx.ip}` : "customer", note: "rescheduled" });
      await tx.updateBooking(b);
      return b;
    });
    if (updated.calendarEventId) {
      try { await this.d.calendar.updateEvent(updated.calendarEventId, { start: updated.start, end: updated.end }); }
      catch { updated.syncError = "Google Calendar event could not be updated"; await this.d.store.updateBooking(updated); }
    }
    await this.safeNotify({ type: "booking_rescheduled", booking: updated });
    return updated;
  }

  // ---------- admin ----------
  async setStatus(id: string, status: BookingStatus, ctx: { actor: string }): Promise<Booking> {
    const b = await this.d.store.getBooking(id);
    if (!b) throw new NotFoundError();
    if (["cancelled", "rejected"].includes(b.status) && ["pending", "confirmed", "rescheduled"].includes(status))
      throw new ValidationError("A cancelled or rejected booking cannot be re-opened; create a new booking instead");
    const evt = status === "confirmed" ? "booking_confirmed" : status === "cancelled" ? "booking_cancelled" : status === "rejected" ? "booking_rejected" : undefined;
    return this.transition(b, status, ctx.actor, evt);
  }

  private async transition(b: Booking, status: BookingStatus, actor: string, evt?: NotifyEvent["type"]) {
    const now = this.d.now();
    b.status = status; b.updatedAt = now; b.history.push({ status, at: now, actor });
    if (["cancelled", "rejected"].includes(status) && b.calendarEventId) {
      try { await this.d.calendar.deleteEvent(b.calendarEventId); b.calendarEventId = undefined; }
      catch { b.syncError = "Google Calendar event could not be removed"; }
    }
    await this.d.store.updateBooking(b);
    if (status === "confirmed" && !b.calendarEventId) await this.syncCreate(b);
    if (evt) await this.safeNotify({ type: evt, booking: b });
    return b;
  }
}

/** Strips internal fields (calendar ids, history actors) for anything returned to customers. */
export function toPublicView(b: Booking) {
  return {
    reference: b.reference, status: b.status, programTitle: b.programTitle, start: b.start.toISOString(),
    end: b.end.toISOString(), timezone: b.timezone, format: b.format, organization: b.organization,
    fullName: b.fullName, participants: b.participants,
  };
}
export type { Interval };
