import type { MailMessage } from "@/lib/email/templates";

/** Provider-agnostic: swap Resend for SendGrid/SES by implementing this interface. */
export interface Mailer { send(m: MailMessage): Promise<void> }

export class ConsoleMailer implements Mailer {
  sent: MailMessage[] = [];
  async send(m: MailMessage) { this.sent.push(m); if (process.env.NODE_ENV !== "test") console.info(`[mail] to=${m.to} subject=${m.subject}`); }
}

export class ResendMailer implements Mailer {
  constructor(private apiKey: string, private from: string, private f: typeof fetch = fetch) {}
  async send(m: MailMessage) {
    const r = await this.f("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from: this.from, to: [m.to], subject: m.subject, html: m.html }),
    });
    if (!r.ok) throw new Error(`Email provider error ${r.status}`);
  }
}
