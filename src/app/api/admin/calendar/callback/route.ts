import { exchangeCode, GoogleCalendarProvider, listCalendars } from "@/lib/calendar/google";
import { encryptSecret } from "@/lib/security/crypto";
import { verifyState } from "@/lib/security/state";
import { clientIp, json } from "@/server/http";
import { getContainer } from "@/server/container";

/** Not wrapped in the admin session guard: the cross-site redirect from Google can't carry the Strict session cookie.
 *  Authenticity comes from the signed `state` (bound to the admin) + the HttpOnly nonce cookie. */
export async function GET(req: Request) {
  const c = getContainer();
  const url = new URL(req.url);
  const state = url.searchParams.get("state"), code = url.searchParams.get("code");
  const nonce = /(?:^|;\s*)gcal_nonce=([^;]+)/.exec(req.headers.get("cookie") ?? "")?.[1];
  const st = state && c.env.sessionSecret ? await verifyState(state, c.env.sessionSecret) : null;
  const back = (q: string) => new Response(null, { status: 302, headers: { location: `${c.env.siteUrl}/admin/google-calendar?${q}`, "cache-control": "no-store" } });
  if (!st || !nonce || st.nonce !== nonce || st.sub !== c.env.adminEmail || !code) return json({ error: "Invalid or expired authorization request" }, 400);
  try {
    const { refreshToken } = await exchangeCode({ code, clientId: c.env.googleClientId, clientSecret: c.env.googleClientSecret, redirectUri: c.env.googleRedirectUri });
    const probe = new GoogleCalendarProvider({ clientId: c.env.googleClientId, clientSecret: c.env.googleClientSecret, refreshToken, calendarIds: ["primary"] });
    const primary = (await listCalendars(probe)).items.find(i => i.primary);
    await c.repos.calendar.save({ googleEmail: (primary?.id ?? "unknown").toLowerCase(), refreshTokenEnc: encryptSecret(refreshToken, c.env.encKey), calendarIds: ["primary"], status: "connected" });
    await c.repos.audit.log({ actor: st.sub, action: "calendar.connected", ip: clientIp(req), next: { googleEmail: primary?.id } });
    return back("connected=1");
  } catch {
    await c.repos.audit.log({ actor: st.sub, action: "calendar.connect_failed", ip: clientIp(req) });
    return back("error=1");
  }
}
