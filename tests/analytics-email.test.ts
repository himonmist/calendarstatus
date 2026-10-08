import { describe, it, expect } from "vitest";
import { buildAnalytics } from "@/lib/analytics";
import { renderEmail } from "@/lib/email/templates";
import type { Booking } from "@/lib/booking/types";

const mk = (o: Partial<Booking>): Booking => ({
  id: crypto.randomUUID(), reference: "TRN-2026-00125", programId: "p1", programTitle: "AI for Pharma",
  start: new Date("2026-10-20T04:00:00Z"), end: new Date("2026-10-20T06:00:00Z"), timezone: "Asia/Dhaka", status: "confirmed",
  fullName: "Md Rahman", email: "r@x.com", phone: "+8801712345678", organization: "ABC", participants: 20, format: "online",
  leadSource: "website", createdAt: new Date(), updatedAt: new Date(), history: [], ...o,
});

describe("analytics", () => {
  const now = new Date("2026-10-20T00:00:00Z");
  const data = [
    mk({}),
    mk({ status: "pending", programId: "p2", programTitle: "AI Agents", format: "onsite", industry: "Pharma", start: new Date("2026-11-03T08:00:00Z"), end: new Date("2026-11-03T10:00:00Z") }),
    mk({ status: "cancelled", organization: "XYZ" }),
    mk({ status: "completed", organization: "XYZ", start: new Date("2026-09-10T04:00:00Z"), end: new Date("2026-09-10T08:00:00Z") }),
  ];
  const a = buildAnalytics(data, { now, timezone: "Asia/Dhaka" });
  it("computes KPIs", () => {
    expect(a.kpis.total).toBe(4);
    expect(a.kpis.confirmed).toBe(1);
    expect(a.kpis.pending).toBe(1);
    expect(a.kpis.cancellationRate).toBe(0.25);
    expect(a.kpis.organizations).toBe(2);
    expect(a.kpis.trainingHours).toBe(6); // confirmed 2h + completed 4h; pending/cancelled excluded
    expect(a.kpis.todaysBookings).toBe(1);
    expect(a.kpis.upcoming).toBe(2);
    expect(a.kpis.leadConversion).toBeCloseTo(0.5);
  });
  it("breaks down by month, program, status, format, weekday, hour", () => {
    expect(a.byMonth.map(m => m.month)).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(a.byProgram[0]).toMatchObject({ title: "AI for Pharma", count: 3 });
    expect(a.byStatus.confirmed).toBe(1);
    expect(a.byFormat.onsite).toBe(1);
    expect(a.byWeekday).toHaveLength(7);
    expect(a.byHour["10:00"]).toBeGreaterThan(0);
  });
  it("supports date filtering", () => {
    const f = buildAnalytics(data, { now, timezone: "Asia/Dhaka", from: new Date("2026-10-01Z"), to: new Date("2026-10-31Z") });
    expect(f.kpis.total).toBe(2);
  });
  it("handles empty input without NaN", () => {
    const e = buildAnalytics([], { now, timezone: "Asia/Dhaka" });
    expect(e.kpis.cancellationRate).toBe(0);
    expect(e.kpis.leadConversion).toBe(0);
  });
});

describe("email templates", () => {
  it("renders booking-received with reference, status, and Dhaka time", () => {
    const m = renderEmail({ type: "booking_received", booking: mk({ status: "pending" }) }, "https://site.test");
    expect(m.to).toBe("r@x.com");
    expect(m.subject).toBe("Training Booking Request Received — TRN-2026-00125");
    expect(m.html).toContain("TRN-2026-00125");
    expect(m.html).toContain("10:00 AM – 12:00 PM");
    expect(m.html).toContain("Pending Confirmation");
    expect(m.html).toContain("https://site.test/manage");
  });
  it("escapes user-controlled values (no HTML/script injection)", () => {
    const m = renderEmail({ type: "booking_received", booking: mk({ organization: `<img src=x onerror=alert(1)>`, fullName: `"><script>x</script>` }) }, "https://site.test");
    expect(m.html).not.toContain("<script>");
    expect(m.html).not.toContain("<img src=x");
    expect(m.html).toContain("&lt;img");
  });
  it("blocks header injection in subject", () => {
    const m = renderEmail({ type: "booking_received", booking: mk({ reference: "TRN-2026-00125\r\nBcc: evil@x.com" }) }, "https://s");
    expect(m.subject).not.toMatch(/[\r\n]/);
  });
  it("covers every event type; admin mail goes to the admin address", () => {
    for (const t of ["booking_received", "booking_confirmed", "booking_cancelled", "booking_rescheduled", "booking_rejected"] as const)
      expect(renderEmail({ type: t, booking: mk({}) }, "https://s").to).toBe("r@x.com");
    expect(renderEmail({ type: "admin_new_booking", booking: mk({}) }, "https://s", "admin@me.com").to).toBe("admin@me.com");
    expect(renderEmail({ type: "reminder_24h", booking: mk({}) }, "https://s").subject).toContain("Reminder");
  });
});
