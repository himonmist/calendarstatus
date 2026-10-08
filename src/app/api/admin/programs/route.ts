import { programSchema } from "@/lib/validation";
import { handler } from "@/server/http";

export const GET = handler({ admin: true }, async ({ c }) => ({ programs: await c.repos.programs.list(false) }));

export const POST = handler({ admin: true, schema: programSchema, maxBytes: 65_536 }, async ({ c, body, session, ip }) => {
  const prev = await c.repos.programs.get(body.id);
  await c.repos.programs.upsert({ ...body, slug: body.id });
  await c.repos.audit.log({ actor: session!.sub, action: prev ? "program.updated" : "program.created", entity: "program", entityId: body.id, ip, previous: prev ?? undefined, next: body });
  return { ok: true };
});
