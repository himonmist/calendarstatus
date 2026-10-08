import { handler } from "@/server/http";

export const GET = handler({ admin: true }, async ({ c }) => ({ entries: await c.repos.audit.list(200) }));
