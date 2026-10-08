import { getContainer } from "@/server/container";
import { cronAuthorized } from "@/server/cron-auth";
import { json } from "@/server/http";
import { sendDueReminders } from "@/server/reminders";

export async function GET(req: Request) {
  const c = getContainer();
  if (!cronAuthorized(req, c)) return json({ error: "Unauthorized" }, 401);
  return json({ sent: await sendDueReminders(c) });
}
