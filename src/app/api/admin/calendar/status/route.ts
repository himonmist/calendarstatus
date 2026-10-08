import { calendarStatus } from "@/server/calendar-sync";
import { handler } from "@/server/http";

export const GET = handler({ admin: true }, async ({ c }) => calendarStatus(c));
