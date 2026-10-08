import { handler, json } from "@/server/http";

export const GET = handler({ rate: { name: "avail", limit: 120, windowMs: 60_000 } }, async ({ c, url, params }) => {
  const program = url.searchParams.get("program") ?? "";
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(params.date) || Number.isNaN(Date.parse(params.date))) return json({ error: "Invalid date" }, 400);
  const day = await c.svc.getDay(params.date, program);
  return { date: day.date, timezone: day.timezone, slots: day.slots.map(s => ({ start: s.start.toISOString(), end: s.end.toISOString(), available: s.available })) };
});
