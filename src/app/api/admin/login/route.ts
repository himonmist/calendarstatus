import { timingSafeEqual } from "node:crypto";
import { hashPassword, verifyPassword } from "@/lib/security/password";
import { signSession } from "@/lib/security/session";
import { loginSchema } from "@/lib/validation";
import { cookieName, handler, json } from "@/server/http";

const MAX_AGE = 8 * 3600;
let dummy: Promise<string> | undefined;

export const POST = handler({ schema: loginSchema, rate: { name: "login", limit: 5, windowMs: 15 * 60_000 } }, async ({ c, body, ip }) => {
  // Always do the same work whether or not the email matches (no user enumeration / timing oracle).
  const emailOk = c.env.adminEmail.length > 0 && body.email.length === c.env.adminEmail.length &&
    timingSafeEqual(Buffer.from(body.email), Buffer.from(c.env.adminEmail));
  const hash = c.env.adminPasswordHash || (await (dummy ??= hashPassword("dummy-password")));
  const passOk = await verifyPassword(body.password, hash);
  if (!(emailOk && passOk && c.env.adminPasswordHash && c.env.sessionSecret)) {
    await c.repos.audit.log({ actor: `unknown@${ip}`, action: "admin.login_failed", ip });
    return json({ error: "Invalid email or password" }, 401);
  }
  const token = await signSession({ sub: c.env.adminEmail, role: "admin" }, c.env.sessionSecret, MAX_AGE);
  await c.repos.audit.log({ actor: c.env.adminEmail, action: "admin.login", ip });
  const cookie = [`${cookieName(c)}=${token}`, "Path=/", `Max-Age=${MAX_AGE}`, "HttpOnly", "SameSite=Strict", ...(c.env.secureCookies ? ["Secure"] : [])].join("; ");
  return json({ ok: true }, 200, { "set-cookie": cookie });
});
