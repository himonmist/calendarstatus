import { overlaps, type Interval } from "../time";
import type { BusyBlock, CalendarEventInput, CalendarProvider, PrivateEvent } from "../booking/types";

/** Deterministic in-memory calendar for tests and demo mode. */
export class FakeCalendar implements CalendarProvider {
  events = new Map<string, CalendarEventInput>();
  private external: (Interval & { title: string })[] = [];
  failReads = false; failWrites = false;
  private n = 0;

  addBusy(start: Date, end: Date, title = "Private meeting") { this.external.push({ start, end, title }); }

  async getBusy(range: Interval): Promise<BusyBlock[]> {
    if (this.failReads) throw new Error("calendar unavailable");
    return [
      ...this.external.filter(e => overlaps(e, range)).map(e => ({ start: e.start, end: e.end })),
      ...[...this.events.values()].filter(e => overlaps(e, range)).map(e => ({ start: e.start, end: e.end, managed: true })),
    ];
  }
  async listEvents(range: Interval): Promise<PrivateEvent[]> {
    return [
      ...this.external.filter(e => overlaps(e, range)).map((e, i) => ({ id: `ext_${i}`, start: e.start, end: e.end, title: e.title })),
      ...[...this.events.entries()].filter(([, e]) => overlaps(e, range)).map(([id, e]) => ({ id, start: e.start, end: e.end, title: e.title, managed: true })),
    ];
  }
  async createEvent(input: CalendarEventInput) {
    if (this.failWrites) throw new Error("calendar write failed");
    const id = `evt_${++this.n}`; this.events.set(id, input); return id;
  }
  async updateEvent(id: string, patch: Partial<CalendarEventInput>) {
    if (this.failWrites) throw new Error("calendar write failed");
    const e = this.events.get(id); if (e) this.events.set(id, { ...e, ...patch });
  }
  async deleteEvent(id: string) { if (this.failWrites) throw new Error("calendar write failed"); this.events.delete(id); }
}
