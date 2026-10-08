import { toPublicView } from "@/lib/booking/service";
import { bookingInputSchema } from "@/lib/validation";
import { handler, json } from "@/server/http";

export const POST = handler({ schema: bookingInputSchema, rate: { name: "book", limit: 10, windowMs: 10 * 60_000 } }, async ({ c, body, ip }) => {
  const b = await c.svc.createBooking(body, { ip });
  await c.repos.audit.log({ actor: `customer@${ip}`, action: "booking.submitted", entity: "booking", entityId: b.reference, ip });
  return json({ booking: toPublicView(b) }, 201);
});
