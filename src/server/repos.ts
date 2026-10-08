import type { AvailabilityConfig } from "@/lib/availability";
import type { Program } from "@/lib/booking/types";

export interface ProgramFull extends Program {
  slug: string; shortDescription: string; fullDescription?: string; formats: string[]; priceText: string;
  objectives: string[]; audience?: string; modules: string[]; bannerUrl?: string; sortOrder: number;
}
export interface AuditEntry { actor: string; action: string; entity?: string; entityId?: string; ip?: string; previous?: unknown; next?: unknown; at?: Date }
export interface CalendarAccount { googleEmail: string; refreshTokenEnc: string; calendarIds: string[]; status: "connected" | "needs_reauth"; lastSyncedAt?: Date }

export interface Repos {
  programs: { list(activeOnly: boolean): Promise<ProgramFull[]>; get(id: string): Promise<ProgramFull | null>; upsert(p: ProgramFull): Promise<void> };
  settings: { get<T>(key: string): Promise<T | null>; set(key: string, value: unknown): Promise<void> };
  audit: { log(e: AuditEntry): Promise<void>; list(limit: number): Promise<AuditEntry[]> };
  requests: { add(payload: unknown): Promise<string>; list(): Promise<{ id: string; payload: any; status: string; createdAt: Date }[]> };
  calendar: {
    get(): Promise<CalendarAccount | null>; save(a: CalendarAccount): Promise<void>;
    setStatus(status: CalendarAccount["status"], lastSyncedAt?: Date): Promise<void>;
    log(status: "ok" | "error", detail?: string): Promise<void>; logs(limit: number): Promise<{ status: string; detail?: string; at: Date }[]>;
  };
  reminders: { wasSent(bookingId: string, kind: string): Promise<boolean>; markSent(bookingId: string, kind: string): Promise<void> };
  emailLogs: { add(e: { to: string; subject: string; status: "sent" | "failed"; error?: string }): Promise<void> };
}

export const DEFAULT_AVAILABILITY: Omit<AvailabilityConfig, "durationMin"> = {
  timezone: "Asia/Dhaka",
  weekly: {
    0: { start: "10:00", end: "18:00" }, 1: { start: "10:00", end: "18:00" }, 2: { start: "10:00", end: "18:00" },
    3: { start: "10:00", end: "18:00" }, 4: { start: "10:00", end: "16:00" }, 5: null, 6: { start: "10:00", end: "14:00" },
  },
  blockedDates: [], bufferBeforeMin: 30, bufferAfterMin: 30, stepMin: 30, minNoticeHours: 24, maxAdvanceDays: 90,
};

export class MemoryRepos implements Repos {
  private progs = new Map<string, ProgramFull>(); private kv = new Map<string, unknown>();
  private auditLog: AuditEntry[] = []; private reqs: any[] = []; private acct: CalendarAccount | null = null;
  private syncLogs: any[] = []; private sent = new Set<string>(); emails: any[] = [];
  programs = {
    list: async (activeOnly: boolean) => [...this.progs.values()].filter(p => !activeOnly || p.active).sort((a, b) => a.sortOrder - b.sortOrder),
    get: async (id: string) => this.progs.get(id) ?? null,
    upsert: async (p: ProgramFull) => { this.progs.set(p.id, p); },
  };
  settings = {
    get: async <T,>(k: string) => (this.kv.has(k) ? (this.kv.get(k) as T) : null),
    set: async (k: string, v: unknown) => { this.kv.set(k, v); },
  };
  audit = {
    log: async (e: AuditEntry) => { this.auditLog.unshift({ ...e, at: new Date() }); },
    list: async (n: number) => this.auditLog.slice(0, n),
  };
  requests = {
    add: async (payload: unknown) => { const id = crypto.randomUUID(); this.reqs.unshift({ id, payload, status: "new", createdAt: new Date() }); return id; },
    list: async () => this.reqs,
  };
  calendar = {
    get: async () => this.acct, save: async (a: CalendarAccount) => { this.acct = a; },
    setStatus: async (status: CalendarAccount["status"], at?: Date) => { if (this.acct) this.acct = { ...this.acct, status, lastSyncedAt: at ?? this.acct.lastSyncedAt }; },
    log: async (status: "ok" | "error", detail?: string) => { this.syncLogs.unshift({ status, detail, at: new Date() }); },
    logs: async (n: number) => this.syncLogs.slice(0, n),
  };
  reminders = {
    wasSent: async (id: string, k: string) => this.sent.has(`${id}:${k}`),
    markSent: async (id: string, k: string) => { this.sent.add(`${id}:${k}`); },
  };
  emailLogs = { add: async (e: any) => { this.emails.push(e); } };
}
