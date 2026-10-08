import { randomUUID } from "node:crypto";
import type { Db, Queryable } from "../db";
import type { Interval } from "../time";
import { BLOCKING_STATUSES, type Booking, type Hold, type Store } from "./types";

const LOCK_KEY = 727_001; // arbitrary app-wide advisory lock id for booking mutations

const SELECT = `
  SELECT b.*, c.email, c.full_name, c.phone, c.designation, c.country, c.city, o.name AS organization,
         o.industry, o.organization_type,
         COALESCE((SELECT json_agg(json_build_object('status', h.status, 'at', h.created_at, 'actor', h.actor, 'note', h.note) ORDER BY h.id)
                   FROM booking_status_history h WHERE h.booking_id = b.id), '[]'::json) AS history
  FROM bookings b JOIN customers c ON c.id = b.customer_id JOIN organizations o ON o.id = b.organization_id`;

function toBooking(r: any): Booking {
  return {
    id: r.id, reference: r.booking_reference, programId: r.training_program_id, programTitle: r.program_title,
    start: new Date(r.start_time), end: new Date(r.end_time), timezone: r.timezone, status: r.status,
    fullName: r.full_name, email: r.email, phone: r.phone, organization: r.organization, designation: r.designation ?? undefined,
    country: r.country ?? undefined, city: r.city ?? undefined, industry: r.industry ?? undefined,
    organizationType: r.organization_type ?? undefined, experienceLevel: r.experience_level ?? undefined,
    participants: r.participant_count, format: r.format, location: r.location ?? undefined,
    budgetRange: r.budget_range ?? undefined, notes: r.notes ?? undefined, leadSource: r.lead_source,
    calendarEventId: r.google_calendar_event_id ?? undefined, syncError: r.sync_error ?? undefined,
    createdAt: new Date(r.created_at), updatedAt: new Date(r.updated_at),
    history: (r.history as any[]).map(h => ({ status: h.status, at: new Date(h.at), actor: h.actor, note: h.note ?? undefined })),
  };
}

/** Postgres-backed store. Every parameter is bound ($n) — no string-built SQL — so it is injection-safe. */
export class PgStore implements Store {
  constructor(private db: Db, private q: Queryable = db, private locked = false) {}

  async transaction<T>(fn: (tx: Store) => Promise<T>): Promise<T> {
    if (this.locked) return fn(this);
    return this.db.tx(async q => {
      await q.query("SELECT pg_advisory_xact_lock($1)", [LOCK_KEY]); // serialises all booking writers
      return fn(new PgStore(this.db, q, true));
    });
  }

  async listBlockingBookings(range: Interval, excludeId?: string) {
    const { rows } = await this.q.query(
      `${SELECT} WHERE b.status = ANY($1) AND b.start_time < $3 AND b.end_time > $2 AND ($4::uuid IS NULL OR b.id <> $4::uuid)`,
      [BLOCKING_STATUSES, range.start, range.end, excludeId ?? null]);
    return rows.map(toBooking);
  }
  async listActiveHolds(range: Interval, now: Date, excludeHash?: string) {
    const { rows } = await this.q.query(
      `SELECT * FROM temporary_reservations WHERE expires_at > $1 AND start_time < $3 AND end_time > $2 AND ($4::text IS NULL OR token_hash <> $4)`,
      [now, range.start, range.end, excludeHash ?? null]);
    return rows.map(toHold);
  }
  async insertHold(h: Hold) {
    await this.q.query(`INSERT INTO temporary_reservations (token_hash, training_program_id, start_time, end_time, expires_at) VALUES ($1,$2,$3,$4,$5)`,
      [h.tokenHash, h.programId, h.start, h.end, h.expiresAt]);
  }
  async getHold(hash: string) {
    const { rows } = await this.q.query(`SELECT * FROM temporary_reservations WHERE token_hash = $1`, [hash]);
    return rows[0] ? toHold(rows[0]) : null;
  }
  async deleteHold(hash: string) { await this.q.query(`DELETE FROM temporary_reservations WHERE token_hash = $1`, [hash]); }
  async purgeExpiredHolds(now: Date) {
    const r: any = await this.q.query(`DELETE FROM temporary_reservations WHERE expires_at <= $1 RETURNING 1`, [now]);
    return r.rows.length;
  }

  async insertBooking(b: Booking) {
    const org = await this.q.query(
      `INSERT INTO organizations (name, industry, organization_type, country, city) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (lower(name)) DO UPDATE SET industry = COALESCE(EXCLUDED.industry, organizations.industry) RETURNING id`,
      [b.organization, b.industry ?? null, b.organizationType ?? null, b.country ?? null, b.city ?? null]);
    const cust = await this.q.query(
      `INSERT INTO customers (email, full_name, phone, designation, country, city, organization_id) VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, phone = EXCLUDED.phone, organization_id = EXCLUDED.organization_id RETURNING id`,
      [b.email, b.fullName, b.phone, b.designation ?? null, b.country ?? null, b.city ?? null, org.rows[0].id]);
    await this.q.query(
      `INSERT INTO bookings (id, booking_reference, customer_id, organization_id, training_program_id, program_title, start_time, end_time, timezone,
         format, location, participant_count, status, experience_level, budget_range, lead_source, google_calendar_event_id, sync_error, notes, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
      [b.id, b.reference, cust.rows[0].id, org.rows[0].id, b.programId, b.programTitle, b.start, b.end, b.timezone, b.format, b.location ?? null,
        b.participants, b.status, b.experienceLevel ?? null, b.budgetRange ?? null, b.leadSource, b.calendarEventId ?? null, b.syncError ?? null,
        b.notes ?? null, b.createdAt, b.updatedAt]);
    await this.syncHistory(b);
  }
  async updateBooking(b: Booking) {
    await this.q.query(
      `UPDATE bookings SET start_time=$2, end_time=$3, status=$4, google_calendar_event_id=$5, sync_error=$6, updated_at=$7 WHERE id=$1`,
      [b.id, b.start, b.end, b.status, b.calendarEventId ?? null, b.syncError ?? null, b.updatedAt]);
    await this.syncHistory(b);
  }
  private async syncHistory(b: Booking) {
    const { rows } = await this.q.query(`SELECT count(*)::int AS n FROM booking_status_history WHERE booking_id = $1`, [b.id]);
    for (const h of b.history.slice(rows[0].n))
      await this.q.query(`INSERT INTO booking_status_history (booking_id, status, actor, note, created_at) VALUES ($1,$2,$3,$4,$5)`,
        [b.id, h.status, h.actor, h.note ?? null, h.at]);
  }
  async getBooking(id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const { rows } = await this.q.query(`${SELECT} WHERE b.id = $1`, [id]);
    return rows[0] ? toBooking(rows[0]) : null;
  }
  async getBookingByRef(ref: string) {
    const { rows } = await this.q.query(`${SELECT} WHERE b.booking_reference = $1`, [ref]);
    return rows[0] ? toBooking(rows[0]) : null;
  }
  async listBookings() {
    const { rows } = await this.q.query(`${SELECT} ORDER BY b.start_time DESC`);
    return rows.map(toBooking);
  }
  async nextSequence(year: number) {
    const { rows } = await this.q.query(
      `INSERT INTO booking_sequences (year, last_value) VALUES ($1, 1) ON CONFLICT (year) DO UPDATE SET last_value = booking_sequences.last_value + 1 RETURNING last_value`, [year]);
    return rows[0].last_value as number;
  }
}
const toHold = (r: any): Hold => ({ tokenHash: r.token_hash, programId: r.training_program_id, start: new Date(r.start_time), end: new Date(r.end_time), expiresAt: new Date(r.expires_at) });
void randomUUID;
