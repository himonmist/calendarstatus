import type { Booking } from "@/lib/booking/types";

/** Admin-only projection. Never expose the raw calendar event id — only whether it is synced. */
export const adminView = (b: Booking) => ({
  id: b.id, reference: b.reference, status: b.status, programId: b.programId, programTitle: b.programTitle, start: b.start.toISOString(), end: b.end.toISOString(),
  timezone: b.timezone, fullName: b.fullName, email: b.email, phone: b.phone, organization: b.organization, designation: b.designation, industry: b.industry,
  country: b.country, city: b.city, participants: b.participants, format: b.format, location: b.location, budgetRange: b.budgetRange, notes: b.notes,
  leadSource: b.leadSource, calendarSynced: !!b.calendarEventId, syncError: b.syncError, createdAt: b.createdAt.toISOString(), history: b.history,
});
