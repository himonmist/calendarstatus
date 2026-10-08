import type { Interval } from "../time";

export type BookingStatus = "pending" | "confirmed" | "rejected" | "cancelled" | "rescheduled" | "completed" | "no_show";
/** Statuses that occupy the trainer's time. */
export const BLOCKING_STATUSES: BookingStatus[] = ["pending", "confirmed", "rescheduled"];

export interface Program {
  id: string; title: string; durationMin: number; active: boolean;
  minParticipants: number; maxParticipants: number;
}

export interface StatusEntry { status: BookingStatus; at: Date; actor: string; note?: string }

export interface Booking {
  id: string; reference: string; programId: string; programTitle: string;
  start: Date; end: Date; timezone: string;
  status: BookingStatus;
  fullName: string; email: string; phone: string; organization: string; designation?: string;
  country?: string; city?: string; industry?: string; organizationType?: string; experienceLevel?: string;
  participants: number; format: "online" | "onsite" | "hybrid"; location?: string;
  budgetRange?: string; notes?: string; leadSource: string;
  /** Internal only — never serialised to public clients. */
  calendarEventId?: string; syncError?: string;
  createdAt: Date; updatedAt: Date;
  history: StatusEntry[];
}

export interface Hold { tokenHash: string; programId: string; start: Date; end: Date; expiresAt: Date }

export interface Store {
  /** Runs fn with exclusive access (global lock / advisory lock / serializable tx). */
  transaction<T>(fn: (tx: Store) => Promise<T>): Promise<T>;
  listBlockingBookings(range: Interval, excludeId?: string): Promise<Booking[]>;
  listActiveHolds(range: Interval, now: Date, excludeHash?: string): Promise<Hold[]>;
  insertHold(h: Hold): Promise<void>;
  getHold(tokenHash: string): Promise<Hold | null>;
  deleteHold(tokenHash: string): Promise<void>;
  purgeExpiredHolds(now: Date): Promise<number>;
  insertBooking(b: Booking): Promise<void>;
  updateBooking(b: Booking): Promise<void>;
  getBooking(id: string): Promise<Booking | null>;
  getBookingByRef(ref: string): Promise<Booking | null>;
  listBookings(): Promise<Booking[]>;
  nextSequence(year: number): Promise<number>;
}

export interface BusyBlock extends Interval { /** true for events this app created (DB is source of truth for those). */ managed?: boolean }

export interface CalendarEventInput {
  title: string; description: string; start: Date; end: Date; timezone: string; attendeeEmail?: string;
}

/** Private details: ADMIN ONLY. Never route through public endpoints. */
export interface PrivateEvent extends Interval { id: string; title: string; managed?: boolean }

export interface CalendarProvider {
  listEvents?(range: Interval): Promise<PrivateEvent[]>;
  getBusy(range: Interval): Promise<BusyBlock[]>;
  createEvent(input: CalendarEventInput): Promise<string>;
  updateEvent(id: string, patch: Partial<CalendarEventInput>): Promise<void>;
  deleteEvent(id: string): Promise<void>;
}

export type NotifyEvent =
  | { type: "booking_received" | "admin_new_booking" | "booking_confirmed" | "booking_cancelled" | "booking_rescheduled" | "booking_rejected" | "reminder_24h" | "reminder_1h"; booking: Booking };
