import { z } from "zod";
import { handler } from "@/server/http";

const schema = z.object({ programId: z.string().min(1).max(64), slotStart: z.string().datetime() });

export const POST = handler({ schema, rate: { name: "reserve", limit: 20, windowMs: 10 * 60_000 } }, async ({ c, body }) => {
  const h = await c.svc.reserve(body.programId, new Date(body.slotStart));
  return { token: h.token, expiresAt: h.expiresAt.toISOString(), message: "This time slot is temporarily reserved for you." };
});
