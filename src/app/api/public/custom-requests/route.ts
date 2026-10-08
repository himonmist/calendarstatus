import { customRequestSchema } from "@/lib/validation";
import { handler, json } from "@/server/http";

export const POST = handler({ schema: customRequestSchema, rate: { name: "custom", limit: 5, windowMs: 60 * 60_000 } }, async ({ c, body, ip }) => {
  const id = await c.repos.requests.add(body);
  await c.repos.audit.log({ actor: `customer@${ip}`, action: "custom_request.submitted", entity: "custom_request", entityId: id, ip });
  return json({ ok: true, message: "Thank you — your custom training request has been received." }, 201);
});
