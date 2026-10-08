import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { readFileSync } from "node:fs";
import { PgStore } from "@/lib/booking/pg-store";
import { BookingService, SlotUnavailableError } from "@/lib/booking/service";
import { FakeCalendar } from "@/lib/calendar/fake";
import { zonedToUtc } from "@/lib/time";
import type { Db } from "@/lib/db";

const TZ = "Asia/Dhaka", D = "2026-10-20";
const at = (t: string) => zonedToUtc(D, t, TZ);
let pg: PGlite, db: Db, store: PgStore;

beforeAll(async () => {
  pg = new PGlite({ extensions: { btree_gist } });
  await pg.exec(readFileSync("migrations/001_init.sql", "utf8"));
  await pg.exec(`INSERT INTO training_programs (id, slug, title, short_description, duration_min, max_participants) VALUES ('p1','p1','AI for Pharma','d',120,100)`);
  db = { query: (s, p) => pg.query(s, p as any[]) as any, tx: fn => pg.transaction(t => fn({ query: (s, p) => t.query(s, p as any[]) as any })) };
  store = new PgStore(db);
});

const svc = (auto = true) => new BookingService({
  store, calendar: new FakeCalendar(), now: () => new Date("2026-10-08T00:00:00Z"), autoConfirm: auto,
  getConfig: async () => ({ timezone: TZ, weekly: { 2: { start: "09:00", end: "18:00" } } as any, blockedDates: [], durationMin: 120,
    bufferBeforeMin: 30, bufferAfterMin: 30, stepMin: 30, minNoticeHours: 0, maxAdvanceDays: 365 }),
  getProgram: async () => ({ id: "p1", title: "AI for Pharma", durationMin: 120, active: true, minParticipants: 1, maxParticipants: 100 }),
  notify: async () => {}, holdTtlMs: 600_000, cancellationDeadlineHours: 24,
});
const input = (token: string, t: string) => ({
  programId: "p1", slotStart: at(t).toISOString(), holdToken: token, fullName: "Md Rahman", organization: "ABC Pharma",
  email: "rahman@example.com", phone: "+8801712345678", participants: 5, format: "online" as const, leadSource: "website" as const,
});

describe("PgStore + BookingService on real Postgres SQL", () => {
  it("runs the full flow and persists normalized rows + history", async () => {
    const s = svc();
    const h = await s.reserve("p1", at("10:00"));
    const b = await s.createBooking(input(h.token, "10:00"), { ip: "9.9.9.9" });
    expect(b.reference).toMatch(/^TRN-2026-00001$/);
    const back = await s.lookup(b.reference, "RAHMAN@example.com");
    expect(back.organization).toBe("ABC Pharma");
    expect(back.history.map(x => x.status)).toEqual(["pending", "confirmed"]);
    const c = await pg.query(`SELECT count(*)::int n FROM customers`); expect((c.rows[0] as any).n).toBe(1);
  });

  it("only one of 20 simultaneous reservations succeeds", async () => {
    const s = svc();
    const r = await Promise.allSettled(Array.from({ length: 20 }, () => s.reserve("p1", at("14:00"))));
    expect(r.filter(x => x.status === "fulfilled")).toHaveLength(1);
    expect((r.find(x => x.status === "rejected") as PromiseRejectedResult).reason).toBeInstanceOf(SlotUnavailableError);
  });

  it("DB exclusion constraint rejects overlapping bookings even if the app is bypassed", async () => {
    const s = svc();
    const h = await s.reserve("p1", at("16:00")).catch(() => null);
    expect(h).toBeNull(); // 16:00 collides with buffer of the 14:00 hold — app layer says no
    await expect(pg.query(
      `INSERT INTO bookings (id, booking_reference, customer_id, organization_id, training_program_id, program_title, start_time, end_time, format, participant_count, status)
       SELECT gen_random_uuid(), 'TRN-2026-77777', customer_id, organization_id, 'p1', 'x', start_time + interval '30 minutes', end_time + interval '30 minutes', 'online', 1, 'pending'
       FROM bookings LIMIT 1`)).rejects.toThrow(/bookings_no_overlap|exclusion/i);
  });

  it("is injection-safe: hostile reference/email are inert bound parameters", async () => {
    const s = svc();
    await expect(s.lookup("TRN-2026-00001'; DROP TABLE bookings;--", "x@y.com")).rejects.toThrow();
    const n = await pg.query(`SELECT count(*)::int n FROM bookings`); expect((n.rows[0] as any).n).toBeGreaterThan(0);
  });
});
