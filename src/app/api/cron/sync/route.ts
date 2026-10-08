import { syncCalendar } from "@/server/calendar-sync";
import { getContainer } from "@/server/container";
import { cronAuthorized } from "@/server/cron-auth";
import { json } from "@/server/http";

export async function GET(req: Request) {
  const c = getContainer();
  if (!cronAuthorized(req, c)) return json({ error: "Unauthorized" }, 401);
  return json(await syncCalendar(c, "system:cron"));
}
