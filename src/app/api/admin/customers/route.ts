import { handler } from "@/server/http";

/** Customers & organizations derived from bookings (each booking is also a lead). */
export const GET = handler({ admin: true }, async ({ c }) => {
  const m = new Map<string, any>();
  for (const b of await c.store.listBookings()) {
    const e = m.get(b.email) ?? { email: b.email, fullName: b.fullName, phone: b.phone, organization: b.organization, industry: b.industry, leadSource: b.leadSource, bookings: 0, participants: 0, lastBooking: b.start };
    e.bookings++; e.participants += b.participants; if (b.start > e.lastBooking) e.lastBooking = b.start; m.set(b.email, e);
  }
  return { customers: [...m.values()].sort((a, b) => +b.lastBooking - +a.lastBooking) };
});
