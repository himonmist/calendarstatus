import { statusSchema } from "@/lib/validation";
import { handler } from "@/server/http";
import { adminView } from "@/server/views";

export const PATCH = handler({ admin: true, schema: statusSchema }, async ({ c, body, params, session, ip }) => {
  const before = await c.store.getBooking(params.id);
  const b = await c.svc.setStatus(params.id, body.status, { actor: session!.sub });
  await c.repos.audit.log({ actor: session!.sub, action: "booking.status_changed", entity: "booking", entityId: b.reference, ip, previous: { status: before?.status }, next: { status: b.status } });
  return { booking: adminView(b) };
});
