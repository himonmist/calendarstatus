import type { Db } from "@/lib/db";
import type { AuditEntry, CalendarAccount, ProgramFull, Repos } from "./repos";

const toProgram = (r: any): ProgramFull => ({
  id: r.id, slug: r.slug, title: r.title, shortDescription: r.short_description, fullDescription: r.full_description ?? undefined,
  durationMin: r.duration_min, formats: r.delivery_formats, minParticipants: r.min_participants, maxParticipants: r.max_participants,
  priceText: r.price_text, objectives: r.learning_objectives, audience: r.target_audience ?? undefined, modules: r.modules,
  bannerUrl: r.banner_url ?? undefined, active: r.active, sortOrder: r.sort_order,
});

export function pgRepos(db: Db): Repos {
  return {
    programs: {
      async list(activeOnly) {
        const { rows } = await db.query(`SELECT * FROM training_programs WHERE ($1::boolean = false OR active) ORDER BY sort_order, title`, [activeOnly]);
        return rows.map(toProgram);
      },
      async get(id) { const { rows } = await db.query(`SELECT * FROM training_programs WHERE id = $1`, [id]); return rows[0] ? toProgram(rows[0]) : null; },
      async upsert(p) {
        await db.query(
          `INSERT INTO training_programs (id, slug, title, short_description, full_description, duration_min, delivery_formats, min_participants, max_participants,
             price_text, learning_objectives, target_audience, modules, banner_url, active, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
           ON CONFLICT (id) DO UPDATE SET slug=$2, title=$3, short_description=$4, full_description=$5, duration_min=$6, delivery_formats=$7, min_participants=$8,
             max_participants=$9, price_text=$10, learning_objectives=$11, target_audience=$12, modules=$13, banner_url=$14, active=$15, sort_order=$16, updated_at=now()`,
          [p.id, p.slug, p.title, p.shortDescription, p.fullDescription ?? null, p.durationMin, p.formats, p.minParticipants, p.maxParticipants, p.priceText,
            p.objectives, p.audience ?? null, p.modules, p.bannerUrl ?? null, p.active, p.sortOrder]);
      },
    },
    settings: {
      async get<T>(key: string) { const { rows } = await db.query(`SELECT value FROM settings WHERE key = $1`, [key]); return rows[0] ? (rows[0].value as T) : null; },
      async set(key, value) { await db.query(`INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=now()`, [key, JSON.stringify(value)]); },
    },
    audit: {
      async log(e: AuditEntry) {
        await db.query(`INSERT INTO audit_logs (actor, action, entity, entity_id, ip, previous_value, new_value) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [e.actor, e.action, e.entity ?? null, e.entityId ?? null, e.ip ?? null, JSON.stringify(e.previous ?? null), JSON.stringify(e.next ?? null)]);
      },
      async list(n) {
        const { rows } = await db.query(`SELECT * FROM audit_logs ORDER BY id DESC LIMIT $1`, [n]);
        return rows.map(r => ({ actor: r.actor, action: r.action, entity: r.entity, entityId: r.entity_id, ip: r.ip, previous: r.previous_value, next: r.new_value, at: new Date(r.created_at) }));
      },
    },
    requests: {
      async add(payload) { const { rows } = await db.query(`INSERT INTO custom_training_requests (payload) VALUES ($1) RETURNING id`, [JSON.stringify(payload)]); return rows[0].id; },
      async list() { const { rows } = await db.query(`SELECT * FROM custom_training_requests ORDER BY created_at DESC LIMIT 500`); return rows.map(r => ({ id: r.id, payload: r.payload, status: r.status, createdAt: new Date(r.created_at) })); },
    },
    calendar: {
      async get() {
        const { rows } = await db.query(`SELECT * FROM calendar_accounts ORDER BY created_at LIMIT 1`);
        const r = rows[0]; if (!r) return null;
        return { googleEmail: r.google_email, refreshTokenEnc: r.refresh_token_enc, calendarIds: r.selected_calendar_ids, status: r.status, lastSyncedAt: r.last_synced_at ? new Date(r.last_synced_at) : undefined } as CalendarAccount;
      },
      async save(a) {
        await db.query(`DELETE FROM calendar_accounts WHERE google_email <> $1`, [a.googleEmail]);
        await db.query(`INSERT INTO calendar_accounts (google_email, refresh_token_enc, selected_calendar_ids, status) VALUES ($1,$2,$3,$4)
          ON CONFLICT (google_email) DO UPDATE SET refresh_token_enc=$2, selected_calendar_ids=$3, status=$4`, [a.googleEmail, a.refreshTokenEnc, a.calendarIds, a.status]);
      },
      async setStatus(status, at) { await db.query(`UPDATE calendar_accounts SET status=$1, last_synced_at=COALESCE($2,last_synced_at)`, [status, at ?? null]); },
      async log(status, detail) { await db.query(`INSERT INTO calendar_sync_logs (status, detail) VALUES ($1,$2)`, [status, detail ?? null]); },
      async logs(n) { const { rows } = await db.query(`SELECT * FROM calendar_sync_logs ORDER BY id DESC LIMIT $1`, [n]); return rows.map(r => ({ status: r.status, detail: r.detail ?? undefined, at: new Date(r.created_at) })); },
    },
    reminders: {
      async wasSent(id, kind) { const { rows } = await db.query(`SELECT 1 FROM notifications WHERE booking_id=$1 AND kind=$2 AND sent_at IS NOT NULL`, [id, kind]); return rows.length > 0; },
      async markSent(id, kind) { await db.query(`INSERT INTO notifications (booking_id, kind, send_at, sent_at) VALUES ($1,$2,now(),now()) ON CONFLICT (booking_id, kind) DO UPDATE SET sent_at = now()`, [id, kind]); },
    },
    emailLogs: { async add(e) { await db.query(`INSERT INTO email_logs (to_email, subject, status, error) VALUES ($1,$2,$3,$4)`, [e.to, e.subject, e.status, e.error ?? null]); } },
  };
}
