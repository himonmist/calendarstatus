import type { Interval } from "../time";
import type { BusyBlock, CalendarEventInput, CalendarProvider, PrivateEvent } from "../booking/types";

const API = "https://www.googleapis.com/calendar/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",         // create/update/delete our booking events
  "https://www.googleapis.com/auth/calendar.freebusy",       // busy/free only — no titles or attendees
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly", // let admin pick calendars
];

export class GoogleCalendarError extends Error {
  constructor(message: string, public code: "REAUTH_REQUIRED" | "UPSTREAM" = "UPSTREAM") { super(message); }
}

export function buildAuthUrl(o: { clientId: string; redirectUri: string; state: string }) {
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.search = new URLSearchParams({
    client_id: o.clientId, redirect_uri: o.redirectUri, response_type: "code", scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline", prompt: "consent", include_granted_scopes: "true", state: o.state,
  }).toString();
  return u.toString();
}

export async function exchangeCode(o: { code: string; clientId: string; clientSecret: string; redirectUri: string; fetch?: typeof fetch }) {
  const res = await (o.fetch ?? fetch)(TOKEN_URL, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code: o.code, client_id: o.clientId, client_secret: o.clientSecret, redirect_uri: o.redirectUri, grant_type: "authorization_code" }),
  });
  if (!res.ok) throw new GoogleCalendarError("Google authorization failed");
  const j = await res.json() as { refresh_token?: string };
  if (!j.refresh_token) throw new GoogleCalendarError("Google did not return a refresh token; re-authorize with consent", "REAUTH_REQUIRED");
  return { refreshToken: j.refresh_token };
}

interface Opts { clientId: string; clientSecret: string; refreshToken: string; calendarIds: string[]; writeCalendarId?: string; fetch?: typeof fetch }

/** Server-side only. Tokens never reach the browser. */
export class GoogleCalendarProvider implements CalendarProvider {
  private access?: { token: string; exp: number };
  private f: typeof fetch;
  constructor(private o: Opts) { this.f = o.fetch ?? fetch; }

  private async token(): Promise<string> {
    if (this.access && this.access.exp > Date.now() + 60_000) return this.access.token;
    const res = await this.f(TOKEN_URL, {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: this.o.clientId, client_secret: this.o.clientSecret, refresh_token: this.o.refreshToken, grant_type: "refresh_token" }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({})) as { error?: string };
      throw new GoogleCalendarError("Google Calendar connection needs to be re-authorized", j.error === "invalid_grant" ? "REAUTH_REQUIRED" : "UPSTREAM");
    }
    const j = await res.json() as { access_token: string; expires_in: number };
    this.access = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
    return j.access_token;
  }

  private async call(method: string, path: string, body?: unknown, okStatuses: number[] = []) {
    const res = await this.f(`${API}${path}`, {
      method, headers: { Authorization: `Bearer ${await this.token()}`, "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok && !okStatuses.includes(res.status)) throw new GoogleCalendarError(`Google Calendar request failed (${res.status})`);
    return res.status === 204 || res.status === 410 || res.status === 404 ? {} : await res.json();
  }

  async getBusy(range: Interval): Promise<BusyBlock[]> {
    const j: any = await this.call("POST", "/freeBusy", {
      timeMin: range.start.toISOString(), timeMax: range.end.toISOString(), items: this.o.calendarIds.map(id => ({ id })),
    });
    const out: BusyBlock[] = [];
    for (const id of this.o.calendarIds) for (const b of j.calendars?.[id]?.busy ?? []) out.push({ start: new Date(b.start), end: new Date(b.end) });
    return out;
  }

  /** Admin-only: real event titles via events.list. */
  async listEvents(range: Interval): Promise<PrivateEvent[]> {
    const out: PrivateEvent[] = [];
    for (const id of this.o.calendarIds) {
      const q = new URLSearchParams({ timeMin: range.start.toISOString(), timeMax: range.end.toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "250" });
      const j: any = await this.call("GET", `/calendars/${encodeURIComponent(id)}/events?${q}`);
      for (const e of j.items ?? []) {
        if (!e.start?.dateTime || e.status === "cancelled") continue;
        out.push({ id: e.id, title: e.summary ?? "(no title)", start: new Date(e.start.dateTime), end: new Date(e.end.dateTime), managed: e.extendedProperties?.private?.app === "calendarstatus" });
      }
    }
    return out;
  }

  private get wid() { return encodeURIComponent(this.o.writeCalendarId ?? this.o.calendarIds[0] ?? "primary"); }

  async createEvent(i: CalendarEventInput): Promise<string> {
    const j: any = await this.call("POST", `/calendars/${this.wid}/events?sendUpdates=all`, {
      summary: i.title, description: i.description,
      start: { dateTime: i.start.toISOString(), timeZone: i.timezone }, end: { dateTime: i.end.toISOString(), timeZone: i.timezone },
      attendees: i.attendeeEmail ? [{ email: i.attendeeEmail }] : undefined,
      extendedProperties: { private: { app: "calendarstatus" } },
    });
    return j.id;
  }

  async updateEvent(id: string, p: Partial<CalendarEventInput>): Promise<void> {
    const tz = p.timezone;
    await this.call("PATCH", `/calendars/${this.wid}/events/${encodeURIComponent(id)}?sendUpdates=all`, {
      summary: p.title, description: p.description,
      start: p.start ? { dateTime: p.start.toISOString(), ...(tz && { timeZone: tz }) } : undefined,
      end: p.end ? { dateTime: p.end.toISOString(), ...(tz && { timeZone: tz }) } : undefined,
    });
  }

  async deleteEvent(id: string): Promise<void> {
    await this.call("DELETE", `/calendars/${this.wid}/events/${encodeURIComponent(id)}?sendUpdates=all`, undefined, [404, 410]);
  }
}

/** Admin helper: calendars the connected account can choose from. */
export async function listCalendars(p: GoogleCalendarProvider) {
  return (p as any).call("GET", "/users/me/calendarList?minAccessRole=reader") as Promise<{ items: { id: string; summary: string; primary?: boolean }[] }>;
}
