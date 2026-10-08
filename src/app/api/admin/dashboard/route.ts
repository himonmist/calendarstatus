import { buildAnalytics } from "@/lib/analytics";
import { calendarStatus } from "@/server/calendar-sync";
import { handler } from "@/server/http";

export const GET = handler({ admin: true }, async ({ c, url }) => {
  const cfg = await c.availability();
  const d = (k: string) => { const v = url.searchParams.get(k); const t = v ? new Date(v) : undefined; return t && !Number.isNaN(+t) ? t : undefined; };
  const analytics = buildAnalytics(await c.store.listBookings(), { now: c.now(), timezone: cfg.timezone, from: d("from"), to: d("to") });
  return { analytics, calendar: await calendarStatus(c), requests: (await c.repos.requests.list()).filter(r => r.status === "new").length };
});
