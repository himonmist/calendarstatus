import { overlaps, type Interval } from "../time";
import { BLOCKING_STATUSES, type Booking, type Hold, type Store } from "./types";

/** In-memory store: used for tests and the zero-config demo. Serialises transactions with a promise-chain mutex. */
export class MemoryStore implements Store {
  private bookings = new Map<string, Booking>();
  private holds = new Map<string, Hold>();
  private seq = new Map<number, number>();
  private tail: Promise<unknown> = Promise.resolve();

  transaction<T>(fn: (tx: Store) => Promise<T>): Promise<T> {
    const run = this.tail.then(() => fn(this));
    this.tail = run.catch(() => undefined);
    return run;
  }
  async listBlockingBookings(range: Interval, excludeId?: string) {
    return [...this.bookings.values()].filter(b => b.id !== excludeId && BLOCKING_STATUSES.includes(b.status) && overlaps(b, range));
  }
  async listActiveHolds(range: Interval, now: Date, excludeHash?: string) {
    return [...this.holds.values()].filter(h => h.tokenHash !== excludeHash && h.expiresAt > now && overlaps(h, range));
  }
  async insertHold(h: Hold) { this.holds.set(h.tokenHash, h); }
  async getHold(hash: string) { return this.holds.get(hash) ?? null; }
  async deleteHold(hash: string) { this.holds.delete(hash); }
  async purgeExpiredHolds(now: Date) {
    let n = 0; for (const [k, h] of this.holds) if (h.expiresAt <= now) { this.holds.delete(k); n++; } return n;
  }
  async insertBooking(b: Booking) { this.bookings.set(b.id, structuredClone(b)); }
  async updateBooking(b: Booking) { this.bookings.set(b.id, structuredClone(b)); }
  async getBooking(id: string) { const b = this.bookings.get(id); return b ? structuredClone(b) : null; }
  async getBookingByRef(ref: string) {
    for (const b of this.bookings.values()) if (b.reference === ref) return structuredClone(b);
    return null;
  }
  async listBookings() { return [...this.bookings.values()].map(b => structuredClone(b)); }
  async nextSequence(year: number) { const n = (this.seq.get(year) ?? 0) + 1; this.seq.set(year, n); return n; }
}
