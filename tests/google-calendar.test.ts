import { describe, it, expect, vi } from "vitest";
import { GoogleCalendarProvider, buildAuthUrl } from "@/lib/calendar/google";

const mkFetch = (routes: Record<string, (init: RequestInit, url: URL) => any>) =>
  vi.fn(async (input: any, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const key = `${init.method ?? "GET"} ${url.origin}${url.pathname}`;
    const h = routes[key];
    if (!h) return new Response("not mocked: " + key, { status: 500 });
    const r = h(init, url);
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status ?? 200, headers: { "content-type": "application/json" } });
  });

const tokenRoute = { "POST https://oauth2.googleapis.com/token": () => ({ body: { access_token: "AT", expires_in: 3600 } }) };
const base = { clientId: "cid", clientSecret: "sec", refreshToken: "rt", calendarIds: ["primary"] };

describe("GoogleCalendarProvider", () => {
  it("builds an offline-access auth URL with state + minimal scope", () => {
    const u = new URL(buildAuthUrl({ clientId: "cid", redirectUri: "https://x/cb", state: "st123" }));
    expect(u.searchParams.get("access_type")).toBe("offline");
    expect(u.searchParams.get("state")).toBe("st123");
    expect(u.searchParams.get("scope")).toContain("calendar.events");
    expect(u.searchParams.get("response_type")).toBe("code");
  });

  it("uses freeBusy so no event titles ever leave Google", async () => {
    const f = mkFetch({
      ...tokenRoute,
      "POST https://www.googleapis.com/calendar/v3/freeBusy": () => ({
        body: { calendars: { primary: { busy: [{ start: "2026-10-20T05:00:00Z", end: "2026-10-20T06:00:00Z" }] } } },
      }),
    });
    const p = new GoogleCalendarProvider({ ...base, fetch: f as any });
    const busy = await p.getBusy({ start: new Date("2026-10-20T00:00Z"), end: new Date("2026-10-21T00:00Z") });
    expect(busy).toEqual([{ start: new Date("2026-10-20T05:00:00Z"), end: new Date("2026-10-20T06:00:00Z") }]);
    const call = f.mock.calls.find(c => String(c[0]).includes("freeBusy"))!;
    expect((call[1]!.headers as any).Authorization).toBe("Bearer AT");
  });

  it("caches the access token between calls", async () => {
    const f = mkFetch({ ...tokenRoute, "POST https://www.googleapis.com/calendar/v3/freeBusy": () => ({ body: { calendars: { primary: { busy: [] } } } }) });
    const p = new GoogleCalendarProvider({ ...base, fetch: f as any });
    const r = { start: new Date(), end: new Date(Date.now() + 1000) };
    await p.getBusy(r); await p.getBusy(r);
    expect(f.mock.calls.filter(c => String(c[0]).includes("oauth2")).length).toBe(1);
  });

  it("creates events tagged as app-managed and returns the id", async () => {
    let body: any;
    const f = mkFetch({ ...tokenRoute, "POST https://www.googleapis.com/calendar/v3/calendars/primary/events": init => { body = JSON.parse(String(init.body)); return { body: { id: "gid1" } }; } });
    const p = new GoogleCalendarProvider({ ...base, fetch: f as any });
    const id = await p.createEvent({ title: "AI Training — ABC", description: "d", start: new Date("2026-10-20T04:00Z"), end: new Date("2026-10-20T06:00Z"), timezone: "Asia/Dhaka", attendeeEmail: "a@b.com" });
    expect(id).toBe("gid1");
    expect(body.summary).toBe("AI Training — ABC");
    expect(body.extendedProperties.private.app).toBe("calendarstatus");
    expect(body.start.timeZone).toBe("Asia/Dhaka");
  });

  it("throws a sanitized error and flags reauth when the refresh token is revoked", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ error: "invalid_grant", error_description: "secret detail" }), { status: 400 }));
    const p = new GoogleCalendarProvider({ ...base, fetch: f as any });
    const err = await p.getBusy({ start: new Date(), end: new Date() }).catch(e => e);
    expect(err.code).toBe("REAUTH_REQUIRED");
    expect(err.message).not.toContain("secret detail");
  });

  it("treats 404/410 on delete as success (idempotent)", async () => {
    const f = mkFetch({ ...tokenRoute, "DELETE https://www.googleapis.com/calendar/v3/calendars/primary/events/gone": () => ({ status: 410 }) });
    const p = new GoogleCalendarProvider({ ...base, fetch: f as any });
    await expect(p.deleteEvent("gone")).resolves.toBeUndefined();
  });
});
