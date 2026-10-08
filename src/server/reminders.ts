import { renderEmail } from "@/lib/email/templates";
import type { Container } from "./container";

export async function sendDueReminders(c: Container) {
  const now = c.now().getTime();
  let sent = 0;
  for (const b of await c.store.listBookings()) {
    if (b.status !== "confirmed") continue;
    const left = (b.start.getTime() - now) / 3_600_000;
    const kind = left > 0 && left <= 1 ? "reminder_1h" : left > 1 && left <= 24 ? "reminder_24h" : null;
    if (!kind || (await c.repos.reminders.wasSent(b.id, kind))) continue;
    try {
      await c.mailer.send(renderEmail({ type: kind, booking: b }, c.env.siteUrl));
      await c.repos.reminders.markSent(b.id, kind); sent++;
    } catch { await c.repos.emailLogs.add({ to: b.email, subject: kind, status: "failed", error: "send failed" }); }
  }
  return sent;
}
