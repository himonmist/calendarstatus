import { handler } from "@/server/http";
import { adminView } from "@/server/views";

export const GET = handler({ admin: true }, async ({ c, url }) => {
  const status = url.searchParams.get("status");
  const all = (await c.store.listBookings()).filter(b => !status || b.status === status).sort((a, b) => +b.start - +a.start);
  return { bookings: all.slice(0, 500).map(adminView) };
});
