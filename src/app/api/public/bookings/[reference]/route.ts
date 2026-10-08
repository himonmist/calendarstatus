import { z } from "zod";
import { toPublicView } from "@/lib/booking/service";
import { handler } from "@/server/http";

// POST (not GET) so the customer's email never lands in URLs / access logs.
const schema = z.object({ email: z.string().trim().toLowerCase().email().max(254) });

export const POST = handler({ schema, rate: { name: "lookup", limit: 10, windowMs: 15 * 60_000 } }, async ({ c, body, params }) => {
  return { booking: toPublicView(await c.svc.lookup(params.reference, body.email)) };
});
