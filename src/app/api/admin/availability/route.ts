import { availabilitySchema } from "@/lib/validation";
import { handler } from "@/server/http";
import { DEFAULT_AVAILABILITY } from "@/server/repos";

export const GET = handler({ admin: true }, async ({ c }) => {
  const { durationMin: _d, ...cfg } = await c.availability(); void _d;
  return { availability: cfg, autoConfirm: (await c.repos.settings.get<boolean>("autoConfirm")) ?? false };
});

export const POST = handler({ admin: true, schema: availabilitySchema }, async ({ c, body, session, ip }) => {
  const current = await c.repos.settings.get<object>("availability") ?? {};
  const merged = { ...DEFAULT_AVAILABILITY, ...current, ...body, weekly: { ...DEFAULT_AVAILABILITY.weekly, ...(current as any).weekly, ...(body.weekly ?? {}) } };
  await c.repos.settings.set("availability", merged);
  await c.repos.audit.log({ actor: session!.sub, action: "availability.changed", ip, previous: current, next: body });
  return { ok: true, availability: merged };
});
