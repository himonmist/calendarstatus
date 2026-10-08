import { z } from "zod";
import { handler } from "@/server/http";

export const POST = handler({ admin: true, schema: z.object({ enabled: z.boolean() }) }, async ({ c, body, session, ip }) => {
  const prev = (await c.repos.settings.get<boolean>("autoConfirm")) ?? false;
  await c.repos.settings.set("autoConfirm", body.enabled);
  await c.repos.audit.log({ actor: session!.sub, action: "settings.auto_confirm_changed", ip, previous: { enabled: prev }, next: { enabled: body.enabled } });
  return { ok: true };
});
