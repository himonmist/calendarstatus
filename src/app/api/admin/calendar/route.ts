import { z } from "zod";
import { utcToZonedParts, zonedToUtc } from "@/lib/time";
import { handler, json } from "@/server/http";

const q = z.object({ from: z.string().regex(/^20\d{2}-\d{2}-\d{2}$/), to: z.string().regex(/^20\d{2}-\d{2}-\d{2}$/) });

/** ADMIN ONLY: includes private Google event titles. Authorization is enforced by the handler, not the UI. */
export const GET = handler({ admin: true }, async ({ c, url }) => {
  const p = q.safeParse(Object.fromEntries(url.searchParams));
  if (!p.success) return json({ error: "from and to (YYYY-MM-DD) are required" }, 400);
  const cfg = await c.availability();
  const range = { start: zonedToUtc(p.data.from, "00:00", cfg.timezone), end: new Date(zonedToUtc(p.data.to, "00:00", cfg.timezone).getTime() + 86_400_000) };
  if (range.end.getTime() - range.start.getTime() > 62 * 86_400_000) return json({ error: "Range too large (max 62 days)" }, 400);
  const cal = await c.calendar();
  const events = cal.listEvents ? await cal.listEvents(range) : (await cal.getBusy(range)).map((b, i) => ({ id: String(i), title: "Busy", ...b }));
  const bookings = (await c.store.listBookings()).filter(b => b.start < range.end && b.end > range.start);
  return {
    timezone: cfg.timezone,
    events: events.filter(e => !e.managed).map(e => ({ id: e.id, title: e.title, start: e.start.toISOString(), end: e.end.toISOString() })),
    bookings: bookings.map(b => ({ id: b.id, reference: b.reference, title: `${b.organization} — ${b.programTitle}`, status: b.status, start: b.start.toISOString(), end: b.end.toISOString() })),
    blockedDates: cfg.blockedDates.filter(d => d >= p.data.from && d <= p.data.to),
    weekly: cfg.weekly, today: utcToZonedParts(c.now(), cfg.timezone).date,
  };
});
