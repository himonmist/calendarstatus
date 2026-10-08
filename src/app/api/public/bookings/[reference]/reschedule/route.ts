import { z } from "zod";
import { toPublicView } from "@/lib/booking/service";
import { handler } from "@/server/http";

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(254), slotStart: z.string().datetime() });

export const POST = handler({ schema, rate: { name: "lookup", limit: 10, windowMs: 15 * 60_000 } }, async ({ c, body, params, ip }) => {
  const b = await c.svc.reschedule(params.reference, body.email, new Date(body.slotStart), { ip });
  await c.repos.audit.log({ actor: `customer@${ip}`, action: "booking.rescheduled_by_customer", entity: "booking", entityId: b.reference, ip });
  return { booking: toPublicView(b) };
});
