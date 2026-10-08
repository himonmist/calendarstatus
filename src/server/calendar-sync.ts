import { GoogleCalendarError } from "@/lib/calendar/google";
import type { Container } from "./container";

/** Pulls the next 60 days of busy data, records the outcome, and flags re-auth when the token is revoked. */
export async function syncCalendar(c: Container, actor: string, ip?: string) {
  const now = c.now();
  try {
    const cal = await c.calendar();
    const busy = await cal.getBusy({ start: now, end: new Date(now.getTime() + 60 * 86_400_000) });
    await c.repos.calendar.setStatus("connected", now);
    await c.repos.calendar.log("ok", `${busy.length} busy blocks`);
    await c.repos.audit.log({ actor, action: "calendar.sync_completed", ip, next: { busyBlocks: busy.length } });
    return { ok: true as const, busyBlocks: busy.length, syncedAt: now.toISOString() };
  } catch (e) {
    const reauth = e instanceof GoogleCalendarError && e.code === "REAUTH_REQUIRED";
    if (reauth) await c.repos.calendar.setStatus("needs_reauth");
    await c.repos.calendar.log("error", reauth ? "re-authorization required" : "upstream error");
    await c.repos.audit.log({ actor, action: "calendar.sync_failed", ip, next: { reauth } });
    return { ok: false as const, reauth };
  }
}

export async function calendarStatus(c: Container) {
  const a = await c.repos.calendar.get();
  const logs = await c.repos.calendar.logs(1);
  const last = logs[0];
  return {
    connected: !!a && a.status === "connected" || c.demo,
    demo: c.demo && !a,
    googleEmail: a?.googleEmail ?? null,
    calendarIds: a?.calendarIds ?? [],
    lastSyncedAt: a?.lastSyncedAt?.toISOString() ?? null,
    health: a?.status === "needs_reauth" ? "needs_reauth" : last?.status === "error" ? "attention" : "healthy",
  };
}
