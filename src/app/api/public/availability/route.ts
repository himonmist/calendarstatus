import { z } from "zod";
import { handler, json } from "@/server/http";

const q = z.object({ program: z.string().min(1).max(64), month: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/) });

export const GET = handler({ rate: { name: "avail", limit: 120, windowMs: 60_000 } }, async ({ c, url }) => {
  const parsed = q.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return json({ error: "Invalid program or month" }, 400);
  const [y, m] = parsed.data.month.split("-").map(Number);
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const dates = Array.from({ length: n }, (_, i) => `${parsed.data.month}-${String(i + 1).padStart(2, "0")}`);
  return { month: parsed.data.month, timezone: (await c.availability()).timezone, days: await c.svc.getMonth(dates, parsed.data.program) };
});
