import { z } from "zod";
import { handler } from "@/server/http";
import { DEFAULT_AVAILABILITY } from "@/server/repos";

const schema = z.object({ date: z.string().regex(/^20\d{2}-\d{2}-\d{2}$/), action: z.enum(["add", "remove"]), reason: z.string().max(120).optional() });

export const POST = handler({ admin: true, schema }, async ({ c, body, session, ip }) => {
  const cur = ((await c.repos.settings.get<any>("availability")) ?? { ...DEFAULT_AVAILABILITY });
  const set = new Set<string>(cur.blockedDates ?? []);
  body.action === "add" ? set.add(body.date) : set.delete(body.date);
  await c.repos.settings.set("availability", { ...DEFAULT_AVAILABILITY, ...cur, blockedDates: [...set].sort() });
  await c.repos.audit.log({ actor: session!.sub, action: `blocked_date.${body.action}`, ip, next: { date: body.date, reason: body.reason } });
  return { ok: true, blockedDates: [...set].sort() };
});
