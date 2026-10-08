import { cookieName, handler, json } from "@/server/http";

export const POST = handler({ admin: true }, async ({ c, session, ip }) => {
  await c.repos.audit.log({ actor: session!.sub, action: "admin.logout", ip });
  return json({ ok: true }, 200, { "set-cookie": `${cookieName(c)}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict${c.env.secureCookies ? "; Secure" : ""}` });
});
