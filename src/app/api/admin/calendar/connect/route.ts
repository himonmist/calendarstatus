import { randomBytes } from "node:crypto";
import { buildAuthUrl } from "@/lib/calendar/google";
import { signState } from "@/lib/security/state";
import { handler, json } from "@/server/http";

export const GET = handler({ admin: true }, async ({ c, session }) => {
  if (!c.env.googleClientId || !c.env.googleClientSecret) return json({ error: "Google OAuth is not configured. See docs/GOOGLE_OAUTH.md." }, 501);
  const nonce = randomBytes(16).toString("base64url");
  const state = await signState({ sub: session!.sub, nonce }, c.env.sessionSecret);
  const url = buildAuthUrl({ clientId: c.env.googleClientId, redirectUri: c.env.googleRedirectUri, state });
  // Lax (not Strict) is required: Google redirects back via a cross-site top-level navigation.
  const nonceCookie = `gcal_nonce=${nonce}; Path=/api/admin/calendar; Max-Age=600; HttpOnly; SameSite=Lax${c.env.secureCookies ? "; Secure" : ""}`;
  return new Response(null, { status: 302, headers: { location: url, "set-cookie": nonceCookie, "cache-control": "no-store" } });
});
