import { describe, it, expect } from "vitest";
import { computeDaySlots, summarizeDay, type AvailabilityConfig } from "@/lib/availability";
import { zonedToUtc } from "@/lib/time";

const TZ = "Asia/Dhaka";
const at = (d: string, t: string) => zonedToUtc(d, t, TZ);
const iv = (d: string, a: string, b: string) => ({ start: at(d, a), end: at(d, b) });

const weekly = {
  0: { start: "10:00", end: "18:00" }, 1: { start: "10:00", end: "18:00" },
  2: { start: "10:00", end: "18:00" }, 3: { start: "10:00", end: "18:00" },
  4: { start: "10:00", end: "16:00" }, 5: null, 6: { start: "10:00", end: "14:00" },
};
const base = (over: Partial<AvailabilityConfig> = {}): AvailabilityConfig => ({
  timezone: TZ, weekly: { ...weekly, 0: { start: "09:00", end: "18:00" } } as any,
  blockedDates: [], durationMin: 120, bufferBeforeMin: 30, bufferAfterMin: 30, stepMin: 30,
  minNoticeHours: 0, maxAdvanceDays: 365, ...over,
});
const now = new Date("2026-10-01T00:00:00Z");
const D = "2026-10-18"; // Sunday
const labels = (s: ReturnType<typeof computeDaySlots>) =>
  s.filter(x => x.available).map(x => x.start.toISOString());

describe("availability engine", () => {
  it("returns no slots on a closed day (Friday)", () => {
    expect(computeDaySlots("2026-10-16", base(), { busy: [], bookings: [], holds: [], now })).toEqual([]);
  });

  it("returns no slots on a blocked date", () => {
    const s = computeDaySlots(D, base({ blockedDates: [D] }), { busy: [], bookings: [], holds: [], now });
    expect(s).toEqual([]);
  });

  it("fits 2h slots on a free day within working hours", () => {
    const s = computeDaySlots(D, base(), { busy: [], bookings: [], holds: [], now });
    expect(s[0].start).toEqual(at(D, "09:00"));
    expect(s.at(-1)!.end).toEqual(at(D, "18:00"));
    expect(s.every(x => x.available)).toBe(true);
  });

  it("applies the spec example: busy 11-12, booking 15-17, buffer 30m", () => {
    const s = computeDaySlots(D, base(), {
      busy: [iv(D, "11:00", "12:00")], bookings: [iv(D, "15:00", "17:00")], holds: [], now,
    });
    const avail = labels(s);
    expect(avail).toContain(at(D, "12:30").toISOString()); // 12:30-14:30, buffer touches both edges only
    expect(avail).not.toContain(at(D, "09:00").toISOString()); // 9-11 + 30m buffer hits 11:00 busy
    expect(avail).not.toContain(at(D, "13:00").toISOString()); // 13-15 +buffer overlaps booking
    expect(avail).not.toContain(at(D, "16:00").toISOString()); // inside booking
  });

  it("treats touching events (no buffer) as non-conflicting", () => {
    const s = computeDaySlots(D, base({ bufferBeforeMin: 0, bufferAfterMin: 0 }), {
      busy: [iv(D, "11:00", "12:00")], bookings: [], holds: [], now,
    });
    expect(labels(s)).toContain(at(D, "09:00").toISOString());
    expect(labels(s)).toContain(at(D, "12:00").toISOString());
  });

  it("temporary holds block slots like bookings", () => {
    const s = computeDaySlots(D, base({ bufferBeforeMin: 0, bufferAfterMin: 0 }), {
      busy: [], bookings: [], holds: [iv(D, "10:00", "12:00")], now,
    });
    expect(labels(s)).not.toContain(at(D, "10:00").toISOString());
    expect(labels(s)).toContain(at(D, "12:00").toISOString());
  });

  it("enforces minimum notice and max advance window", () => {
    const n = at(D, "08:00");
    const s = computeDaySlots(D, base({ minNoticeHours: 4 }), { busy: [], bookings: [], holds: [], now: n });
    expect(labels(s)).not.toContain(at(D, "09:00").toISOString());
    expect(labels(s)).toContain(at(D, "12:00").toISOString());
    expect(computeDaySlots(D, base({ maxAdvanceDays: 1 }), { busy: [], bookings: [], holds: [], now })).toEqual([]);
  });

  it("public slot objects never carry a reason or private data", () => {
    const s = computeDaySlots(D, base(), { busy: [iv(D, "11:00", "12:00")], bookings: [], holds: [], now });
    for (const x of s) expect(Object.keys(x).sort()).toEqual(["available", "end", "start"]);
  });

  it("days in the past or inside the notice window are unavailable, not busy", () => {
    const cfg = base({ minNoticeHours: 24 });
    expect(summarizeDay(D, cfg, { busy: [], bookings: [], holds: [], now: at(D, "12:00") })).toBe("unavailable");
    expect(summarizeDay(D, cfg, { busy: [], bookings: [], holds: [], now: new Date("2026-10-30T00:00:00Z") })).toBe("unavailable");
  });

  it("summarizes day status", () => {
    const cfg = base();
    expect(summarizeDay("2026-10-16", cfg, { busy: [], bookings: [], holds: [], now })).toBe("unavailable");
    expect(summarizeDay(D, cfg, { busy: [], bookings: [], holds: [], now })).toBe("available");
    expect(summarizeDay(D, cfg, { busy: [iv(D, "09:00", "18:00")], bookings: [], holds: [], now })).toBe("busy");
    expect(summarizeDay(D, cfg, { busy: [iv(D, "09:00", "14:30")], bookings: [], holds: [], now })).toBe("limited");
  });
});
