import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createContainer, setContainer, type Env } from "@/server/container";
import { MemoryRepos } from "@/server/repos";
import { MemoryStore } from "@/lib/booking/memory-store";
import { FakeCalendar } from "@/lib/calendar/fake";
import { signState } from "@/lib/security/state";
import { signSession } from "@/lib/security/session";
import { decryptSecret } from "@/lib/security/crypto";
import { GET as callback } from "@/app/api/admin/calendar/callback/route";
import { GET as connect } from "@/app/api/admin/calendar/connect/route";

const SECRET = "z".repeat(48), KEY = "ab".repeat(32);
let repos: MemoryRepos;
const env: Env = { siteUrl: "https://site.test", adminEmail: "admin@me.com", adminPasswordHash: "x", sessionSecret: SECRET, encKey: KEY, cronSecret: "c".repeat(20),
  googleClientId: "cid", googleClientSecret: "sec", googleRedirectUri: "https://site.test/api/admin/calendar/callback", secureCookies: true };

beforeEach(() => { repos = new MemoryRepos(); setContainer(createContainer({ env, repos, store: new MemoryStore(), calendar: new FakeCalendar(), demo: false })); });
afterEach(() => vi.unstubAllGlobals());

const cb = (state: string, nonce: string | null, code = "abc") =>
  callback(new Request(`https://site.test/api/admin/calendar/callback?code=${code}&state=${state}`, { headers: nonce ? { cookie: `gcal_nonce=${nonce}` } : {} }));

describe("Google OAuth callback", () => {
  it("rejects missing, forged, mismatched-nonce and wrong-admin state", async () => {
    const good = await signState({ sub: "admin@me.com", nonce: "N1" }, SECRET);
    expect((await cb("garbage", "N1")).status).toBe(400);
    expect((await cb(good, null)).status).toBe(400);                 // no nonce cookie (login-CSRF / replay from another browser)
    expect((await cb(good, "OTHER")).status).toBe(400);              // nonce mismatch
    expect((await cb(await signState({ sub: "attacker@x.com", nonce: "N1" }, SECRET), "N1")).status).toBe(400);
    expect((await cb(await signState({ sub: "admin@me.com", nonce: "N1" }, "w".repeat(48)), "N1")).status).toBe(400);
    expect(await repos.calendar.get()).toBeNull();
  });

  it("stores the refresh token ENCRYPTED, audits it, and redirects", async () => {
    vi.stubGlobal("fetch", vi.fn(async (u: any) => {
      const url = String(u);
      if (url.includes("oauth2.googleapis.com/token") ) return new Response(JSON.stringify({ refresh_token: "RT-secret", access_token: "AT", expires_in: 3600 }));
      if (url.includes("calendarList")) return new Response(JSON.stringify({ items: [{ id: "Trainer@Gmail.com", summary: "x", primary: true }] }));
      return new Response("{}", { status: 500 });
    }));
    const r = await cb(await signState({ sub: "admin@me.com", nonce: "N1" }, SECRET), "N1");
    expect(r.status).toBe(302);
    expect(r.headers.get("location")).toContain("connected=1");
    const acct = (await repos.calendar.get())!;
    expect(acct.googleEmail).toBe("trainer@gmail.com");
    expect(acct.refreshTokenEnc).not.toContain("RT-secret");
    expect(decryptSecret(acct.refreshTokenEnc, KEY)).toBe("RT-secret");
    expect((await repos.audit.list(5))[0].action).toBe("calendar.connected");
  });

  it("connect redirects to Google with signed state and an HttpOnly Lax nonce cookie", async () => {
    const cookie = `${"__Host-admin_session"}=${await signSession({ sub: "admin@me.com", role: "admin" }, SECRET, 600)}`;
    const r = await connect(new Request("https://site.test/api/admin/calendar/connect", { headers: { cookie } }));
    expect(r.status).toBe(302);
    const loc = new URL(r.headers.get("location")!);
    expect(loc.host).toBe("accounts.google.com");
    expect(loc.searchParams.get("state")!.split(".")).toHaveLength(3);
    expect(r.headers.get("set-cookie")).toMatch(/HttpOnly.*SameSite=Lax|SameSite=Lax.*HttpOnly/);
    expect((await connect(new Request("https://site.test/api/admin/calendar/connect"))).status).toBe(401);
  });
});
