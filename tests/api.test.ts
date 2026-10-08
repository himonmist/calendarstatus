import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { createContainer, setContainer, type Container, type Env } from "@/server/container";
import { MemoryRepos } from "@/server/repos";
import { SEED_PROGRAMS } from "@/server/seed";
import { MemoryStore } from "@/lib/booking/memory-store";
import { FakeCalendar } from "@/lib/calendar/fake";
import { ConsoleMailer } from "@/server/mailer";
import { RateLimiter } from "@/lib/security/rate-limit";
import { hashPassword } from "@/lib/security/password";
import { signSession } from "@/lib/security/session";
import { zonedToUtc } from "@/lib/time";

import { GET as programsGET_ } from "@/app/api/public/training-programs/route";
import { GET as monthGET_ } from "@/app/api/public/availability/route";
import { GET as dayGET_ } from "@/app/api/public/availability/[date]/route";
import { POST as reservePOST_ } from "@/app/api/public/reservations/route";
import { POST as bookPOST_ } from "@/app/api/public/bookings/route";
import { POST as lookupPOST_ } from "@/app/api/public/bookings/[reference]/route";
import { POST as cancelPOST_ } from "@/app/api/public/bookings/[reference]/cancel/route";
import { POST as reschedulePOST_ } from "@/app/api/public/bookings/[reference]/reschedule/route";
import { POST as loginPOST_ } from "@/app/api/admin/login/route";
import { GET as dashGET_ } from "@/app/api/admin/dashboard/route";
import { GET as adminBookingsGET_ } from "@/app/api/admin/bookings/route";
import { PATCH as bookingPATCH_ } from "@/app/api/admin/bookings/[id]/route";
import { GET as adminCalGET_ } from "@/app/api/admin/calendar/route";
import { GET as auditGET_ } from "@/app/api/admin/audit/route";
import { POST as availPOST_ } from "@/app/api/admin/availability/route";
import { GET as remindersGET_ } from "@/app/api/cron/reminders/route";

// Route handlers take Next's RouteContext; most tests don't need params.
const w = (f: (r: Request, c: { params: Promise<any> }) => Promise<Response>) => (r: Request, c: { params: Promise<any> } = { params: Promise.resolve({}) }) => f(r, c);
const programsGET = w(programsGET_);
const monthGET = w(monthGET_);
const dayGET = w(dayGET_);
const reservePOST = w(reservePOST_);
const bookPOST = w(bookPOST_);
const lookupPOST = w(lookupPOST_);
const cancelPOST = w(cancelPOST_);
const reschedulePOST = w(reschedulePOST_);
const loginPOST = w(loginPOST_);
const dashGET = w(dashGET_);
const adminBookingsGET = w(adminBookingsGET_);
const bookingPATCH = w(bookingPATCH_);
const adminCalGET = w(adminCalGET_);
const auditGET = w(auditGET_);
const availPOST = w(availPOST_);
const remindersGET = w(remindersGET_);

const SECRET = "x".repeat(48);
let c: Container, cal: FakeCalendar, mailer: ConsoleMailer, now: Date, pwHash: string;
const D = "2026-10-20";
const at = (t: string) => zonedToUtc(D, t, "Asia/Dhaka");
const PROG = "pharma-marketing-sales";

beforeAll(async () => { pwHash = await hashPassword("Correct Horse 9!"); });
beforeEach(async () => {
  cal = new FakeCalendar(); mailer = new ConsoleMailer(); now = new Date("2026-10-08T00:00:00Z");
  const repos = new MemoryRepos();
  for (const p of SEED_PROGRAMS) await repos.programs.upsert(p);
  await repos.programs.upsert({ ...SEED_PROGRAMS[0], id: "hidden", slug: "hidden", title: "Hidden", active: false });
  const env: Env = { siteUrl: "http://site.test", adminEmail: "admin@me.com", adminPasswordHash: pwHash, sessionSecret: SECRET, encKey: "a".repeat(64),
    cronSecret: "cron-secret-value", googleClientId: "", googleClientSecret: "", googleRedirectUri: "", secureCookies: false };
  c = createContainer({ env, repos, store: new MemoryStore(), calendar: cal, mailer, now: () => now, limiter: new RateLimiter(() => now.getTime()), demo: false });
  setContainer(c);
});

const req = (path: string, o: { method?: string; body?: unknown; cookie?: string; origin?: string; headers?: Record<string, string> } = {}) =>
  new Request(`http://site.test${path}`, {
    method: o.method ?? (o.body ? "POST" : "GET"),
    headers: { "content-type": "application/json", "x-forwarded-host": "site.test", "x-forwarded-for": "5.5.5.5",
      ...(o.origin !== undefined ? { origin: o.origin } : o.method && o.method !== "GET" ? { origin: "http://site.test" } : o.body ? { origin: "http://site.test" } : {}),
      ...(o.cookie ? { cookie: o.cookie } : {}), ...o.headers },
    body: o.body ? JSON.stringify(o.body) : undefined,
  });
const p = (params: Record<string, string>) => ({ params: Promise.resolve(params) });
const adminCookie = async () => `admin_session=${await signSession({ sub: "admin@me.com", role: "admin" }, SECRET, 600)}`;

const bookingBody = (token: string, t = "10:00", over: object = {}) => ({
  programId: PROG, slotStart: at(t).toISOString(), holdToken: token, fullName: "Md Rahman", organization: "ABC Pharmaceuticals Ltd.",
  email: "rahman@example.com", phone: "+8801712345678", participants: 25, format: "online", ...over,
});
async function book(t = "10:00", over: object = {}) {
  const r = await (await reservePOST(req("/api/public/reservations", { body: { programId: PROG, slotStart: at(t).toISOString() } }))).json();
  const res = await bookPOST(req("/api/public/bookings", { body: bookingBody(r.token, t, over) }));
  return { res, data: await res.json(), hold: r };
}

describe("public API", () => {
  it("lists only active programs, with no internal fields", async () => {
    const j = await (await programsGET(req("/api/public/training-programs"))).json();
    expect(j.programs.map((x: any) => x.id)).not.toContain("hidden");
    expect(j.programs).toHaveLength(7);
    expect(Object.keys(j.programs[0])).toContain("title");
  });

  it("month + day availability expose only available/busy; never calendar titles", async () => {
    cal.addBusy(at("10:00"), at("12:00"), "Confidential Client Meeting – Pfizer");
    const m = await monthGET(req(`/api/public/availability?program=${PROG}&month=2026-10`));
    const mj = await m.json();
    expect(["available", "limited", "busy", "unavailable"]).toContain(mj.days[D]);
    const d = await dayGET(req(`/api/public/availability/${D}?program=${PROG}`), p({ date: D }));
    const text = await d.text();
    expect(text).not.toMatch(/Confidential|Pfizer/);
    const dj = JSON.parse(text);
    expect(dj.timezone).toBe("Asia/Dhaka");
    expect(dj.slots.length).toBeGreaterThan(0);
    for (const s of dj.slots) expect(Object.keys(s).sort()).toEqual(["available", "end", "start"]);
  });

  it("rejects malformed date / month / program", async () => {
    expect((await dayGET(req(`/api/public/availability/not-a-date?program=${PROG}`), p({ date: "not-a-date" }))).status).toBe(400);
    expect((await monthGET(req(`/api/public/availability?program=${PROG}&month=2026-13`))).status).toBe(400);
    expect((await dayGET(req(`/api/public/availability/${D}?program=nope`), p({ date: D }))).status).toBe(400);
  });

  it("completes reserve → book → confirmation, returns public view, sends email", async () => {
    const { res, data } = await book();
    expect(res.status).toBe(201);
    expect(data.booking.reference).toMatch(/^TRN-2026-\d{5}$/);
    expect(data.booking.status).toBe("pending");
    expect(JSON.stringify(data)).not.toMatch(/calendarEventId|evt_|history/);
    expect(mailer.sent.some(m => m.to === "rahman@example.com" && m.subject.includes(data.booking.reference))).toBe(true);
  });

  it("second customer on the same slot gets 409 with a friendly message", async () => {
    await book();
    const res = await reservePOST(req("/api/public/reservations", { body: { programId: PROG, slotStart: at("10:00").toISOString() } }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/just booked or became unavailable/);
  });

  it("returns field-level 400s for invalid input and never leaks stack traces", async () => {
    const res = await bookPOST(req("/api/public/bookings", { body: { ...bookingBody("t".repeat(30)), email: "bad", participants: -1 } }));
    expect(res.status).toBe(400);
    const j = await res.json();
    expect(j.fields.map((f: any) => f.path)).toEqual(expect.arrayContaining(["email", "participants"]));
    expect(JSON.stringify(j)).not.toMatch(/at .*\.ts|node_modules/);
  });

  it("returns a generic 500 (no internals) for unexpected failures", async () => {
    c.repos.programs.get = async () => { throw new Error("secret db password=hunter2 at /srv/app.ts:12"); };
    const res = await reservePOST(req("/api/public/reservations", { body: { programId: PROG, slotStart: at("10:00").toISOString() } }));
    expect(res.status).toBe(500);
    const t = await res.text();
    expect(t).not.toMatch(/hunter2|app\.ts/);
    expect(JSON.parse(t).requestId).toBeTruthy();
  });

  it("surfaces calendar outage as 503 with the friendly message", async () => {
    cal.failReads = true;
    const res = await dayGET(req(`/api/public/availability/${D}?program=${PROG}`), p({ date: D }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/couldn't synchronize/);
  });

  it("rate limits abusive booking attempts (429 + Retry-After)", async () => {
    let last!: Response;
    for (let i = 0; i < 25; i++) last = await reservePOST(req("/api/public/reservations", { body: { programId: PROG, slotStart: at("10:00").toISOString() } }));
    expect(last.status).toBe(429);
    expect(Number(last.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("rejects oversized bodies with 413 and invalid JSON with 400", async () => {
    const big = new Request("http://site.test/api/public/bookings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ notes: "x".repeat(70_000) }) });
    expect((await bookPOST(big)).status).toBe(413);
    const bad = new Request("http://site.test/api/public/bookings", { method: "POST", body: "{not json" });
    expect((await bookPOST(bad)).status).toBe(400);
  });
});

describe("manage booking (no account)", () => {
  it("needs reference + matching email; identical 404 for both mismatches", async () => {
    const { data } = await book();
    const ref = data.booking.reference;
    const ok = await lookupPOST(req(`/api/public/bookings/${ref}`, { body: { email: "RAHMAN@example.com" } }), p({ reference: ref }));
    expect(ok.status).toBe(200);
    const wrongEmail = await lookupPOST(req(`/api/public/bookings/${ref}`, { body: { email: "x@example.com" } }), p({ reference: ref }));
    const wrongRef = await lookupPOST(req(`/api/public/bookings/TRN-2026-99999`, { body: { email: "rahman@example.com" } }), p({ reference: "TRN-2026-99999" }));
    expect(wrongEmail.status).toBe(404); expect(wrongRef.status).toBe(404);
    expect(await wrongEmail.text()).toBe(await wrongRef.text());
  });
  it("throttles reference brute-forcing", async () => {
    let last!: Response;
    for (let i = 0; i < 15; i++) last = await lookupPOST(req(`/api/public/bookings/TRN-2026-0000${i % 9}`, { body: { email: "a@b.com" } }), p({ reference: "TRN-2026-00001" }));
    expect(last.status).toBe(429);
  });
  it("customer can reschedule then cancel", async () => {
    const { data } = await book();
    const ref = data.booking.reference;
    const rs = await reschedulePOST(req(`/api/public/bookings/${ref}/reschedule`, { body: { email: "rahman@example.com", slotStart: at("12:00").toISOString() } }), p({ reference: ref }));
    expect(rs.status).toBe(200);
    expect((await rs.json()).booking.start).toBe(at("12:00").toISOString());
    const cx = await cancelPOST(req(`/api/public/bookings/${ref}/cancel`, { body: { email: "rahman@example.com" } }), p({ reference: ref }));
    expect(cx.status).toBe(200);
    expect((await cx.json()).booking.status).toBe("cancelled");
  });
});

describe("admin auth & authorization (enforced in the API, not the UI)", () => {
  it("rejects every admin endpoint without a valid session", async () => {
    const bad = `admin_session=garbage`;
    for (const call of [
      () => dashGET(req("/api/admin/dashboard")), () => adminBookingsGET(req("/api/admin/bookings")), () => adminCalGET(req("/api/admin/calendar")),
      () => auditGET(req("/api/admin/audit")), () => adminBookingsGET(req("/api/admin/bookings", { cookie: bad })),
      () => bookingPATCH(req("/api/admin/bookings/x", { method: "PATCH", body: { status: "confirmed" } }), p({ id: "x" })),
      () => availPOST(req("/api/admin/availability", { body: {} })),
    ]) expect((await call()).status).toBe(401);
  });
  it("rejects a session signed with the wrong secret or expired", async () => {
    const forged = `admin_session=${await signSession({ sub: "evil", role: "admin" }, "y".repeat(48), 600)}`;
    expect((await dashGET(req("/api/admin/dashboard", { cookie: forged }))).status).toBe(401);
    const expired = `admin_session=${await signSession({ sub: "a", role: "admin" }, SECRET, -5)}`;
    expect((await dashGET(req("/api/admin/dashboard", { cookie: expired }))).status).toBe(401);
  });
  it("blocks cross-origin state changes (CSRF) even with a valid cookie", async () => {
    const cookie = await adminCookie();
    const r = await availPOST(req("/api/admin/availability", { body: { blockedDates: [] }, cookie, origin: "https://evil.com" }));
    expect(r.status).toBe(403);
  });
  it("login: wrong password → generic 401; lockout after repeated failures; success sets hardened cookie", async () => {
    const bad = () => loginPOST(req("/api/admin/login", { body: { email: "admin@me.com", password: "nope-nope" } }));
    const r1 = await bad(); expect(r1.status).toBe(401);
    const unknownUser = await loginPOST(req("/api/admin/login", { body: { email: "who@x.com", password: "nope-nope" } }));
    expect(await unknownUser.text()).toBe(await r1.text()); // no user enumeration
    for (let i = 0; i < 4; i++) await bad();
    expect((await bad()).status).toBe(429);
  });
  it("login success issues HttpOnly SameSite=Strict cookie that unlocks the API", async () => {
    const r = await loginPOST(req("/api/admin/login", { body: { email: "admin@me.com", password: "Correct Horse 9!" } }));
    expect(r.status).toBe(200);
    const sc = r.headers.get("set-cookie")!;
    expect(sc).toMatch(/HttpOnly/i); expect(sc).toMatch(/SameSite=Strict/i); expect(sc).toMatch(/Path=\//);
    const cookie = sc.split(";")[0];
    expect((await dashGET(req("/api/admin/dashboard", { cookie }))).status).toBe(200);
  });
});

describe("admin operations", () => {
  it("confirming a booking creates the Google event and writes an audit entry", async () => {
    const { data } = await book();
    const cookie = await adminCookie();
    const list = await (await adminBookingsGET(req("/api/admin/bookings", { cookie }))).json();
    const id = list.bookings[0].id;
    const r = await bookingPATCH(req(`/api/admin/bookings/${id}`, { method: "PATCH", body: { status: "confirmed" }, cookie }), p({ id }));
    expect(r.status).toBe(200);
    expect(cal.events.size).toBe(1);
    const audit = await (await auditGET(req("/api/admin/audit", { cookie }))).json();
    expect(audit.entries[0]).toMatchObject({ actor: "admin@me.com", action: "booking.status_changed" });
    expect(audit.entries[0].previous).toMatchObject({ status: "pending" });
    expect(data.booking.reference).toBeTruthy();
  });
  it("admin calendar shows private titles; public endpoints never do", async () => {
    cal.addBusy(at("14:00"), at("15:00"), "Client Strategy Meeting");
    const cookie = await adminCookie();
    const a = await (await adminCalGET(req(`/api/admin/calendar?from=${D}&to=${D}`, { cookie }))).text();
    expect(a).toContain("Client Strategy Meeting");
    const pub = await (await dayGET(req(`/api/public/availability/${D}?program=${PROG}`), p({ date: D }))).text();
    expect(pub).not.toContain("Client Strategy");
  });
  it("validates availability settings (rejects bad timezone / hours)", async () => {
    const cookie = await adminCookie();
    const bad = await availPOST(req("/api/admin/availability", { body: { timezone: "Mars/Olympus" }, cookie }));
    expect(bad.status).toBe(400);
    const ok = await availPOST(req("/api/admin/availability", { body: { timezone: "Asia/Dhaka", blockedDates: ["2026-12-16"], bufferBeforeMin: 15 }, cookie }));
    expect(ok.status).toBe(200);
    expect((await c.availability()).blockedDates).toContain("2026-12-16");
  });
});

describe("cron", () => {
  it("requires the bearer secret", async () => {
    expect((await remindersGET(req("/api/cron/reminders"))).status).toBe(401);
    expect((await remindersGET(req("/api/cron/reminders", { headers: { authorization: "Bearer wrong" } }))).status).toBe(401);
  });
  it("sends 24h and 1h reminders exactly once", async () => {
    const { data } = await book();
    const cookie = await adminCookie();
    const id = (await (await adminBookingsGET(req("/api/admin/bookings", { cookie }))).json()).bookings[0].id;
    await bookingPATCH(req(`/api/admin/bookings/${id}`, { method: "PATCH", body: { status: "confirmed" }, cookie }), p({ id }));
    mailer.sent.length = 0;
    now = new Date(at("10:00").getTime() - 23 * 3600_000);
    const run = () => remindersGET(req("/api/cron/reminders", { headers: { authorization: "Bearer cron-secret-value" } }));
    await run(); await run();
    expect(mailer.sent.filter(m => m.subject.includes("Training tomorrow"))).toHaveLength(1);
    now = new Date(at("10:00").getTime() - 30 * 60_000);
    await run();
    expect(mailer.sent.filter(m => m.subject.includes("1 hour"))).toHaveLength(1);
    expect(data.booking.reference).toBeTruthy();
  });
});
