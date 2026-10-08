import { formatInTimeZone } from "date-fns-tz";
import { escapeHtml as h } from "../security/html";
import type { Booking, NotifyEvent } from "../booking/types";

export interface MailMessage { to: string; subject: string; html: string }

const STATUS: Record<string, string> = {
  pending: "🟡 Pending Confirmation", confirmed: "🟢 Confirmed", cancelled: "Cancelled", rejected: "Declined",
  rescheduled: "Rescheduled", completed: "Completed", no_show: "No Show",
};
const noCrlf = (s: string) => s.replace(/[\r\n]+/g, " ");

function layout(title: string, intro: string, b: Booking, site: string, cta?: { label: string; href: string }) {
  const tz = b.timezone;
  const date = formatInTimeZone(b.start, tz, "MMMM d, yyyy");
  const time = `${formatInTimeZone(b.start, tz, "h:mm a")} – ${formatInTimeZone(b.end, tz, "h:mm a")}`;
  const row = (k: string, v: string) => `<tr><td style="padding:8px 0;color:#64748b;width:140px">${h(k)}</td><td style="padding:8px 0;color:#0f172a;font-weight:600">${h(v)}</td></tr>`;
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Inter,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;padding:32px;max-width:560px">
<tr><td><h1 style="margin:0 0 8px;font-size:22px;color:#0f172a">${h(title)}</h1>
<p style="margin:0 0 20px;color:#475569;line-height:1.6">${h(intro)}</p>
<table width="100%" style="border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;margin-bottom:20px">
${row("Training", b.programTitle)}${row("Date", date)}${row("Time", `${time} (${tz})`)}${row("Format", b.format)}
${row("Organization", b.organization)}${row("Participants", String(b.participants))}${row("Status", STATUS[b.status] ?? b.status)}${row("Reference", b.reference)}
</table>
${cta ? `<a href="${h(cta.href)}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">${h(cta.label)}</a>` : ""}
<p style="margin:24px 0 0;color:#94a3b8;font-size:12px">${h(site)}</p></td></tr></table></td></tr></table></body></html>`;
}

export function renderEmail(e: NotifyEvent, site: string, adminEmail = ""): MailMessage {
  const b = e.booking, ref = noCrlf(b.reference), manage = { label: "Manage booking", href: `${site}/manage` };
  const hi = `Hello ${b.fullName},`;
  const m = (subject: string, title: string, intro: string, to = b.email, cta: typeof manage | undefined = manage): MailMessage =>
    ({ to, subject: noCrlf(subject), html: layout(title, intro, b, site, cta) });
  switch (e.type) {
    case "booking_received": return m(`Training Booking Request Received — ${ref}`, "Booking request received", `${hi} thank you. We received your request and will confirm shortly.`);
    case "booking_confirmed": return m(`Training Booking Confirmed — ${ref}`, "Your booking is confirmed", `${hi} your training session is confirmed. A calendar invitation has been sent.`);
    case "booking_cancelled": return m(`Training Booking Cancelled — ${ref}`, "Booking cancelled", `${hi} this booking has been cancelled.`);
    case "booking_rejected": return m(`Training Booking Update — ${ref}`, "Booking could not be accepted", `${hi} unfortunately we could not accept this request. Please choose another time.`);
    case "booking_rescheduled": return m(`Training Booking Rescheduled — ${ref}`, "Booking rescheduled", `${hi} your booking has been moved to the time below.`);
    case "reminder_24h": return m(`Reminder: Training tomorrow — ${ref}`, "Your training is tomorrow", `${hi} this is a friendly reminder about your upcoming session.`);
    case "reminder_1h": return m(`Reminder: Training starts in 1 hour — ${ref}`, "Your training starts soon", `${hi} your session begins in about an hour.`);
    case "admin_new_booking": return m(`New booking request — ${ref} — ${b.organization}`, "New booking request", `${b.fullName} (${b.email}, ${b.phone}) requested a session.`, adminEmail, { label: "Open dashboard", href: `${site}/admin/bookings` });
  }
}
