import { describe, it, expect, beforeEach } from "vitest";
import { BookingService, toPublicView, SlotUnavailableError, NotFoundError, CancellationNotAllowedError } from "@/lib/booking/service";
import { MemoryStore } from "@/lib/booking/memory-store";
import { FakeCalendar } from "@/lib/calendar/fake";
import { zonedToUtc } from "@/lib/time";
import type { AvailabilityConfig } from "@/lib/availability";
import type { BookingInput } from "@/lib/validation";

const TZ = "Asia/Dhaka";
const at = (d: string, t: string) => zonedToUtc(d, t, TZ);
const D = "2026-10-20"; // Tuesday
const cfg: AvailabilityConfig = {
  timezone: TZ,
  weekly: { 0: null, 1: null, 2: { start: "09:00", end: "18:00" }, 3: null, 4: null, 5: null, 6: null },
  blockedDates: [], durationMin: 120, bufferBeforeMin: 30, bufferAfterMin: 30, stepMin: 30,
  minNoticeHours: 0, maxAdvanceDays: 365,
};
const program = { id: "p1", title: "AI for Pharmaceutical Marketing", durationMin: 120, active: true, minParticipants: 1, maxParticipants: 100 };

const details = (over: Partial<BookingInput> = {}, slot = "10:00", token = "x"): BookingInput => ({
  programId: "p1", slotStart: at(D, slot).toISOString(), holdToken: token.padEnd(20, "x"),
  fullName: "Md Rahman", organization: "ABC Pharmaceuticals Ltd.", email: "rahman@example.com",
  phone: "+8801712345678", participants: 25, format: "online", leadSource: "website", ...over,
} as BookingInput);

let clock = new Date("2026-10-08T00:00:00Z");
let cal: FakeCalendar, store: MemoryStore, svc: BookingService, sent: string[];

function make(autoConfirm = false) {
  cal = new FakeCalendar(); store = new MemoryStore(); sent = [];
  svc = new BookingService({
    store, calendar: cal, now: () => clock, autoConfirm,
    getConfig: async () => cfg, getProgram: async id => (id === "p1" ? program : null),
    notify: async e => { sent.push(e.type); },
    holdTtlMs: 10 * 60_000, cancellationDeadlineHours: 24,
  });
}
beforeEach(() => { clock = new Date("2026-10-08T00:00:00Z"); make(); });

const slot = (t: string) => at(D, t);

describe("reservations (temporary holds)", () => {
  it("reserves a slot for 10 minutes and returns an opaque token", async () => {
    const h = await svc.reserve("p1", slot("10:00"));
    expect(h.token.length).toBeGreaterThanOrEqual(32);
    expect(h.expiresAt.getTime() - clock.getTime()).toBe(10 * 60_000);
  });
  it("blocks a second hold on the same slot", async () => {
    await svc.reserve("p1", slot("10:00"));
    await expect(svc.reserve("p1", slot("10:00"))).rejects.toBeInstanceOf(SlotUnavailableError);
  });
  it("releases the slot automatically after expiry", async () => {
    await svc.reserve("p1", slot("10:00"));
    clock = new Date(clock.getTime() + 10 * 60_000 + 1);
    await expect(svc.reserve("p1", slot("10:00"))).resolves.toBeTruthy();
  });
  it("only one of many simultaneous attempts wins", async () => {
    const results = await Promise.allSettled(Array.from({ length: 25 }, () => svc.reserve("p1", slot("10:00"))));
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(r => r.status === "rejected")).toHaveLength(24);
  });
  it("rejects slots that are not on the offered grid / outside working hours", async () => {
    await expect(svc.reserve("p1", slot("07:00"))).rejects.toBeInstanceOf(SlotUnavailableError);
    await expect(svc.reserve("p1", new Date(slot("10:00").getTime() + 7 * 60_000))).rejects.toBeInstanceOf(SlotUnavailableError);
  });
  it("rejects when Google Calendar is busy", async () => {
    cal.addBusy(at(D, "10:30"), at(D, "11:30"));
    await expect(svc.reserve("p1", slot("10:00"))).rejects.toBeInstanceOf(SlotUnavailableError);
  });
});

describe("booking creation", () => {
  it("creates a pending booking with a TRN reference and consumes the hold", async () => {
    const h = await svc.reserve("p1", slot("10:00"));
    const b = await svc.createBooking(details({}, "10:00", h.token), { ip: "1.1.1.1" });
    expect(b.reference).toMatch(/^TRN-2026-\d{5}$/);
    expect(b.status).toBe("pending");
    expect(cal.events.size).toBe(0);
    expect(sent).toContain("booking_received");
    await expect(svc.createBooking(details({}, "10:00", h.token), {})).rejects.toBeInstanceOf(SlotUnavailableError);
  });
  it("auto-confirm creates a Google Calendar event with full details", async () => {
    make(true);
    const h = await svc.reserve("p1", slot("10:00"));
    const b = await svc.createBooking(details({}, "10:00", h.token), {});
    expect(b.status).toBe("confirmed");
    const ev = [...cal.events.values()][0];
    expect(ev.title).toBe("AI Training — ABC Pharmaceuticals Ltd.");
    expect(ev.description).toContain(b.reference);
    expect(ev.description).toContain("rahman@example.com");
  });
  it("requires a valid hold token for that exact slot", async () => {
    const h = await svc.reserve("p1", slot("10:00"));
    await expect(svc.createBooking(details({}, "10:00", "bogus"), {})).rejects.toBeInstanceOf(SlotUnavailableError);
    await expect(svc.createBooking(details({}, "13:00", h.token), {})).rejects.toBeInstanceOf(SlotUnavailableError);
  });
  it("rejects expired holds", async () => {
    const h = await svc.reserve("p1", slot("10:00"));
    clock = new Date(clock.getTime() + 11 * 60_000);
    await expect(svc.createBooking(details({}, "10:00", h.token), {})).rejects.toBeInstanceOf(SlotUnavailableError);
  });
  it("re-validates against Google Calendar right before confirming", async () => {
    const h = await svc.reserve("p1", slot("10:00"));
    cal.addBusy(at(D, "11:00"), at(D, "12:00")); // admin adds a meeting after hold
    await expect(svc.createBooking(details({}, "10:00", h.token), {})).rejects.toBeInstanceOf(SlotUnavailableError);
  });
  it("fails closed (no booking) if Google Calendar cannot be read", async () => {
    const h = await svc.reserve("p1", slot("10:00"));
    cal.failReads = true;
    await expect(svc.createBooking(details({}, "10:00", h.token), {})).rejects.toThrow();
    expect(await store.listBookings()).toHaveLength(0);
  });
  it("derives end time from the program, ignoring client input", async () => {
    const h = await svc.reserve("p1", slot("10:00"));
    const b = await svc.createBooking({ ...details({}, "10:00", h.token), slotEnd: "2099-01-01T00:00:00Z" } as any, {});
    expect(b.end.getTime() - b.start.getTime()).toBe(120 * 60_000);
  });
  it("rejects participant counts outside the program range", async () => {
    const h = await svc.reserve("p1", slot("10:00"));
    await expect(svc.createBooking(details({ participants: 500 }, "10:00", h.token), {})).rejects.toThrow(/participants/i);
  });
  it("a confirmed booking blocks the slot for everyone else", async () => {
    const h = await svc.reserve("p1", slot("10:00"));
    await svc.createBooking(details({}, "10:00", h.token), {});
    await expect(svc.reserve("p1", slot("10:00"))).rejects.toBeInstanceOf(SlotUnavailableError);
    await expect(svc.reserve("p1", slot("12:00"))).rejects.toBeInstanceOf(SlotUnavailableError); // buffer
  });
});

describe("public availability", () => {
  it("exposes only available/busy and never calendar details", async () => {
    cal.addBusy(at(D, "11:00"), at(D, "12:00"), "Confidential Client Meeting");
    const day = await svc.getDay(D, "p1");
    const json = JSON.stringify(day);
    expect(json).not.toContain("Confidential");
    expect(day.slots.some(s => !s.available)).toBe(true);
    for (const s of day.slots) expect(Object.keys(s).sort()).toEqual(["available", "end", "start"]);
  });
  it("uses stale cache when Google is briefly down, then fails closed when too stale", async () => {
    await svc.getDay(D, "p1");
    cal.failReads = true;
    clock = new Date(clock.getTime() + 2 * 60_000);
    await expect(svc.getDay(D, "p1")).resolves.toBeTruthy();
    clock = new Date(clock.getTime() + 30 * 60_000);
    await expect(svc.getDay(D, "p1")).rejects.toThrow();
  });
});

describe("manage booking (lookup / cancel / reschedule)", () => {
  async function booked(auto = false) {
    make(auto);
    const h = await svc.reserve("p1", slot("10:00"));
    return svc.createBooking(details({}, "10:00", h.token), {});
  }
  it("requires reference AND matching email; same error for both failures", async () => {
    const b = await booked();
    const e1 = await svc.lookup(b.reference, "other@example.com").catch(e => e);
    const e2 = await svc.lookup("TRN-2026-99999", "rahman@example.com").catch(e => e);
    expect(e1).toBeInstanceOf(NotFoundError);
    expect(e1.message).toBe(e2.message);
    expect((await svc.lookup(b.reference, "RAHMAN@example.com")).reference).toBe(b.reference);
  });
  it("lookup view never leaks internal ids", async () => {
    const b = await booked(true);
    const v = await svc.lookup(b.reference, "rahman@example.com");
    expect(JSON.stringify(toPublicView(v))).not.toMatch(/calendarEventId|google|evt_|history|"id"/i);
  });
  it("cancel removes the calendar event, frees the slot and records history", async () => {
    const b = await booked(true);
    expect(cal.events.size).toBe(1);
    await svc.cancel(b.reference, "rahman@example.com", {});
    expect(cal.events.size).toBe(0);
    expect(sent).toContain("booking_cancelled");
    const h = await svc.reserve("p1", slot("10:00"));
    expect(h.token).toBeTruthy();
    const hist = (await store.getBookingByRef(b.reference))!.history.map(x => x.status);
    expect(hist).toEqual(["pending", "confirmed", "cancelled"]);
  });
  it("blocks customer cancellation inside the deadline", async () => {
    const b = await booked();
    clock = new Date(slot("10:00").getTime() - 2 * 3600_000);
    await expect(svc.cancel(b.reference, "rahman@example.com", {})).rejects.toBeInstanceOf(CancellationNotAllowedError);
  });
  it("reschedule moves booking + calendar event; old slot freed, new slot taken", async () => {
    const b = await booked(true);
    const r = await svc.reschedule(b.reference, "rahman@example.com", slot("14:00"), {});
    expect(r.start).toEqual(slot("14:00"));
    expect([...cal.events.values()][0].start).toEqual(slot("14:00"));
    await expect(svc.reserve("p1", slot("14:00"))).rejects.toBeInstanceOf(SlotUnavailableError);
    await expect(svc.reserve("p1", slot("10:00"))).resolves.toBeTruthy();
    expect(sent).toContain("booking_rescheduled");
  });
  it("reschedule to an unavailable slot fails and leaves booking unchanged", async () => {
    const b = await booked(true);
    cal.addBusy(at(D, "14:00"), at(D, "15:00"));
    await expect(svc.reschedule(b.reference, "rahman@example.com", slot("14:00"), {})).rejects.toBeInstanceOf(SlotUnavailableError);
    expect((await store.getBookingByRef(b.reference))!.start).toEqual(slot("10:00"));
  });
  it("reschedule may overlap its own old slot (shift by 30 min)", async () => {
    const b = await booked(true);
    const r = await svc.reschedule(b.reference, "rahman@example.com", slot("10:30"), {});
    expect(r.start).toEqual(slot("10:30"));
  });
});

describe("admin status changes", () => {
  it("confirming a pending booking creates the calendar event; rejecting frees the slot", async () => {
    const h = await svc.reserve("p1", slot("10:00"));
    const b = await svc.createBooking(details({}, "10:00", h.token), {});
    await svc.setStatus(b.id, "confirmed", { actor: "admin" });
    expect(cal.events.size).toBe(1);
    await svc.setStatus(b.id, "rejected", { actor: "admin" });
    expect(cal.events.size).toBe(0);
    await expect(svc.reserve("p1", slot("10:00"))).resolves.toBeTruthy();
  });
});
