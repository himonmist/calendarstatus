import { syncCalendar } from "@/server/calendar-sync";
import { handler, json } from "@/server/http";

export const POST = handler({ admin: true, rate: { name: "sync", limit: 12, windowMs: 60_000 } }, async ({ c, session, ip }) => {
  const r = await syncCalendar(c, session!.sub, ip);
  return r.ok ? r : json({ ...r, error: r.reauth ? "Your Google Calendar connection needs to be re-authorized." : "We couldn't synchronize your calendar right now. Your existing availability data remains unchanged. Please try again." }, 502);
});
