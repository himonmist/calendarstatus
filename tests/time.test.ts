import { describe, it, expect } from "vitest";
import { zonedToUtc, utcToZonedParts, addMinutes, overlaps } from "@/lib/time";

describe("time", () => {
  it("converts Dhaka wall time to UTC (UTC+6)", () => {
    expect(zonedToUtc("2026-10-15", "10:00", "Asia/Dhaka").toISOString()).toBe("2026-10-15T04:00:00.000Z");
  });
  it("shows the same instant in London (BST in Oct 15 = UTC+1)", () => {
    const p = utcToZonedParts(new Date("2026-10-15T04:00:00Z"), "Europe/London");
    expect(p.date).toBe("2026-10-15");
    expect(p.time).toBe("05:00");
  });
  it("handles date rollover across zones", () => {
    const p = utcToZonedParts(new Date("2026-10-15T20:00:00Z"), "Asia/Dhaka");
    expect(p.date).toBe("2026-10-16");
    expect(p.time).toBe("02:00");
  });
  it("addMinutes + overlaps are half-open intervals", () => {
    const a = { start: new Date("2026-01-01T10:00Z"), end: new Date("2026-01-01T12:00Z") };
    const b = { start: new Date("2026-01-01T12:00Z"), end: new Date("2026-01-01T13:00Z") };
    expect(overlaps(a, b)).toBe(false);
    expect(overlaps(a, { start: addMinutes(a.start, 119), end: b.end })).toBe(true);
  });
});
