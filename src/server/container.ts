import { BookingService } from "@/lib/booking/service";
import { MemoryStore } from "@/lib/booking/memory-store";
import { PgStore } from "@/lib/booking/pg-store";
import type { Store, CalendarProvider, NotifyEvent } from "@/lib/booking/types";
import { FakeCalendar } from "@/lib/calendar/fake";
import { GoogleCalendarProvider } from "@/lib/calendar/google";
import { renderEmail } from "@/lib/email/templates";
import { decryptSecret } from "@/lib/security/crypto";
import { RateLimiter } from "@/lib/security/rate-limit";
import { pgDb } from "@/lib/db";
import type { AvailabilityConfig } from "@/lib/availability";
import { zonedToUtc } from "@/lib/time";
import { ConsoleMailer, ResendMailer, type Mailer } from "./mailer";
import { pgRepos } from "./pg-repos";
import { DEFAULT_AVAILABILITY, MemoryRepos, type Repos } from "./repos";
import { SEED_PROGRAMS, demoBookings } from "./seed";

export interface Env {
  siteUrl: string; adminEmail: string; adminPasswordHash: string; sessionSecret: string; encKey: string; cronSecret: string;
  googleClientId: string; googleClientSecret: string; googleRedirectUri: string; secureCookies: boolean;
}
export function loadEnv(e: NodeJS.ProcessEnv = process.env): Env {
  const siteUrl = e.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    siteUrl, adminEmail: (e.ADMIN_EMAIL ?? "").toLowerCase(), adminPasswordHash: e.ADMIN_PASSWORD_HASH ?? "",
    sessionSecret: e.NEXTAUTH_SECRET ?? "", encKey: e.TOKEN_ENCRYPTION_KEY ?? "", cronSecret: e.CRON_SECRET ?? "",
    googleClientId: e.GOOGLE_CLIENT_ID ?? "", googleClientSecret: e.GOOGLE_CLIENT_SECRET ?? "",
    googleRedirectUri: e.GOOGLE_REDIRECT_URI ?? `${siteUrl}/api/admin/calendar/callback`, secureCookies: siteUrl.startsWith("https://"),
  };
}

class NullCalendar implements CalendarProvider {
  async getBusy() { return []; }
  async createEvent(): Promise<string> { throw new Error("Google Calendar not connected"); }
  async updateEvent() {} async deleteEvent() {}
}

export interface Container {
  env: Env; repos: Repos; store: Store; svc: BookingService; mailer: Mailer; limiter: RateLimiter;
  now: () => Date; demo: boolean;
  calendar(): Promise<CalendarProvider>;
  availability(): Promise<AvailabilityConfig>;
}

export function createContainer(o: Partial<{ env: Env; repos: Repos; store: Store; mailer: Mailer; calendar: CalendarProvider; now: () => Date; limiter: RateLimiter; demo: boolean }> = {}): Container {
  const env = o.env ?? loadEnv();
  const now = o.now ?? (() => new Date());
  let repos = o.repos, store = o.store;
  const demo = o.demo ?? !process.env.DATABASE_URL;
  if (!repos || !store) {
    if (process.env.DATABASE_URL && !o.repos) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Pool } = require("pg") as typeof import("pg");
      const db = pgDb(new Pool({ connectionString: process.env.DATABASE_URL, max: 5, ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: true } }));
      repos = pgRepos(db); store = new PgStore(db);
    } else {
      const m = new MemoryRepos(); repos = m; store = new MemoryStore();
      for (const p of SEED_PROGRAMS) void m.programs.upsert(p);
    }
  }
  const mailer = o.mailer ?? (process.env.EMAIL_API_KEY ? new ResendMailer(process.env.EMAIL_API_KEY, process.env.EMAIL_FROM ?? "bookings@example.com") : new ConsoleMailer());

  let cached: { key: string; p: CalendarProvider } | undefined;
  let fake: FakeCalendar | undefined;
  const calendar = async (): Promise<CalendarProvider> => {
    if (o.calendar) return o.calendar;
    const acct = await repos!.calendar.get();
    if (acct && acct.status === "connected" && env.googleClientId && env.encKey) {
      if (cached?.key !== acct.refreshTokenEnc)
        cached = { key: acct.refreshTokenEnc, p: new GoogleCalendarProvider({ clientId: env.googleClientId, clientSecret: env.googleClientSecret, refreshToken: decryptSecret(acct.refreshTokenEnc, env.encKey), calendarIds: acct.calendarIds }) };
      return cached.p;
    }
    if (demo) { // demo: simulate a private calendar so the UI shows Busy blocks
      if (!fake) {
        fake = new FakeCalendar();
        for (let i = 3; i < 40; i += 4) { const d = new Date(now().getTime() + i * 86_400_000).toISOString().slice(0, 10); fake.addBusy(zonedToUtc(d, "11:00", "Asia/Dhaka"), zonedToUtc(d, "13:00", "Asia/Dhaka"), "Confidential Client Meeting"); }
      }
      return fake;
    }
    return new NullCalendar();
  };
  const delegating: CalendarProvider = {
    getBusy: async r => (await calendar()).getBusy(r), createEvent: async i => (await calendar()).createEvent(i),
    updateEvent: async (id, p) => (await calendar()).updateEvent(id, p), deleteEvent: async id => (await calendar()).deleteEvent(id),
  };

  const availability = async (): Promise<AvailabilityConfig> => ({ ...DEFAULT_AVAILABILITY, ...((await repos!.settings.get<Partial<AvailabilityConfig>>("availability")) ?? {}), durationMin: 120 });
  const notify = async (e: NotifyEvent) => {
    const m = renderEmail(e, env.siteUrl, env.adminEmail);
    if (!m.to) return;
    try { await mailer.send(m); await repos!.emailLogs.add({ to: m.to, subject: m.subject, status: "sent" }); }
    catch (err) { await repos!.emailLogs.add({ to: m.to, subject: m.subject, status: "failed", error: "send failed" }); throw err; }
  };

  const svc = new BookingService({
    store, calendar: delegating, now, notify,
    autoConfirm: async () => (await repos!.settings.get<boolean>("autoConfirm")) ?? false,
    getConfig: availability, getProgram: id => repos!.programs.get(id),
    holdTtlMs: 10 * 60_000, cancellationDeadlineHours: 24,
  });

  if (demo && !o.store) {
    void (async () => { for (const b of demoBookings(now())) await store!.insertBooking(b); })();
  }
  return { env, repos, store, svc, mailer, limiter: o.limiter ?? new RateLimiter(), now, demo, calendar, availability };
}

// globalThis: Next.js may bundle route handlers and server components separately; they must share one container (and in-memory demo store).
const g = globalThis as unknown as { __container?: Container };
export const getContainer = () => (g.__container ??= createContainer());
export const setContainer = (c: Container | undefined) => { g.__container = c; };
