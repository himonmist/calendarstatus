import { z } from "zod";
import { decryptSecret } from "@/lib/security/crypto";
import { GoogleCalendarProvider, listCalendars } from "@/lib/calendar/google";
import { handler, json } from "@/server/http";

async function provider(c: import("@/server/container").Container) {
  const a = await c.repos.calendar.get();
  if (!a) return null;
  return { a, p: new GoogleCalendarProvider({ clientId: c.env.googleClientId, clientSecret: c.env.googleClientSecret, refreshToken: decryptSecret(a.refreshTokenEnc, c.env.encKey), calendarIds: a.calendarIds }) };
}

export const GET = handler({ admin: true }, async ({ c }) => {
  const x = await provider(c); if (!x) return json({ error: "Google Calendar is not connected" }, 409);
  const l = await listCalendars(x.p);
  return { calendars: l.items.map(i => ({ id: i.id, name: i.summary, primary: !!i.primary, selected: x.a.calendarIds.includes(i.id) })) };
});

export const POST = handler({ admin: true, schema: z.object({ calendarIds: z.array(z.string().max(254)).min(1).max(10) }) }, async ({ c, body, session, ip }) => {
  const x = await provider(c); if (!x) return json({ error: "Google Calendar is not connected" }, 409);
  const valid = new Set((await listCalendars(x.p)).items.map(i => i.id));
  if (!body.calendarIds.every(id => valid.has(id))) return json({ error: "Unknown calendar selected" }, 400);
  await c.repos.calendar.save({ ...x.a, calendarIds: body.calendarIds });
  await c.repos.audit.log({ actor: session!.sub, action: "calendar.selection_changed", ip, previous: { calendarIds: x.a.calendarIds }, next: { calendarIds: body.calendarIds } });
  return { ok: true };
});
