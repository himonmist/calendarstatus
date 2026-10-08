import { handler } from "@/server/http";

export const GET = handler({ admin: true }, async ({ c }) => ({ requests: await c.repos.requests.list() }));
