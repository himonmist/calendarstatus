import { randomUUID } from "node:crypto";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { CalendarUnavailableError, CancellationNotAllowedError, NotFoundError, SlotUnavailableError, ValidationError } from "@/lib/booking/service";
import { GoogleCalendarError } from "@/lib/calendar/google";
import { isSameOrigin } from "@/lib/security/csrf";
import { SESSION_COOKIE, verifySession, type SessionPayload } from "@/lib/security/session";
import { getContainer, type Container } from "./container";

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });

export const cookieName = (c: Container) => (c.env.secureCookies ? SESSION_COOKIE : "admin_session");
export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";

function readCookie(req: Request, name: string) {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const i = part.indexOf("="); if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

export interface HandlerCtx<S extends ZodTypeAny> {
  req: Request; c: Container; ip: string; params: Record<string, string>; body: z.infer<S>; session: SessionPayload | null; url: URL;
}
interface Opts<S extends ZodTypeAny> {
  admin?: boolean; schema?: S; maxBytes?: number;
  rate?: { name: string; limit: number; windowMs: number };
}

/** Central guard: rate limit → auth → CSRF (admin) → size-limited JSON parse → validation → safe error mapping. */
export function handler<S extends ZodTypeAny = ZodTypeAny>(opts: Opts<S>, fn: (x: HandlerCtx<S>) => Promise<Response | unknown>) {
  return async (req: Request, routeCtx: { params: Promise<any> }): Promise<Response> => {
    const id = randomUUID();
    try {
      const c = getContainer();
      const ip = clientIp(req);
      if (opts.rate) {
        const r = c.limiter.check(`${opts.rate.name}:${ip}`, opts.rate.limit, opts.rate.windowMs);
        if (!r.allowed) return json({ error: "Too many requests. Please try again shortly." }, 429, { "retry-after": String(r.retryAfterSec) });
      }
      let session: SessionPayload | null = null;
      if (opts.admin) {
        const tok = readCookie(req, cookieName(c));
        session = tok && c.env.sessionSecret ? await verifySession(tok, c.env.sessionSecret) : null;
        if (!session) return json({ error: "Authentication required" }, 401);
        if (!isSameOrigin(req.method, req.headers)) return json({ error: "Cross-origin request blocked" }, 403);
      }
      let body: unknown = undefined;
      if (opts.schema) {
        const max = opts.maxBytes ?? 32_768;
        if (Number(req.headers.get("content-length") ?? 0) > max) return json({ error: "Request too large" }, 413);
        const text = await req.text();
        if (text.length > max) return json({ error: "Request too large" }, 413);
        let raw: unknown;
        try { raw = text ? JSON.parse(text) : {}; } catch { return json({ error: "Invalid JSON" }, 400); }
        body = opts.schema.parse(raw);
      }
      const params: Record<string, string> = routeCtx?.params ? await routeCtx.params : {};
      const out = await fn({ req, c, ip, params, body: body as z.infer<S>, session, url: new URL(req.url) });
      return out instanceof Response ? out : json(out);
    } catch (e) {
      return errorResponse(e, id);
    }
  };
}

export function errorResponse(e: unknown, id: string) {
  if (e instanceof ZodError) return json({ error: "Please check the highlighted fields", fields: e.issues.map(i => ({ path: i.path.join("."), message: i.message })) }, 400);
  if (e instanceof SlotUnavailableError) return json({ error: e.message, code: "SLOT_UNAVAILABLE" }, 409);
  if (e instanceof NotFoundError) return json({ error: e.message }, 404);
  if (e instanceof ValidationError) return json({ error: e.message }, 400);
  if (e instanceof CancellationNotAllowedError) return json({ error: e.message }, 403);
  if (e instanceof CalendarUnavailableError) return json({ error: e.message, code: "CALENDAR_UNAVAILABLE" }, 503);
  if (e instanceof GoogleCalendarError && e.code === "REAUTH_REQUIRED") return json({ error: "Your Google Calendar connection needs to be re-authorized.", code: "REAUTH_REQUIRED" }, 503);
  console.error(`[api-error ${id}]`, e instanceof Error ? e.message : "unknown"); // never return stack traces to clients
  return json({ error: "Something went wrong. Please try again.", requestId: id }, 500);
}
