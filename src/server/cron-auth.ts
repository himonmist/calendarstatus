import { timingSafeEqual } from "node:crypto";
import type { Container } from "./container";

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. */
export function cronAuthorized(req: Request, c: Container): boolean {
  const secret = c.env.cronSecret;
  if (secret.length < 16) return false;
  const given = Buffer.from((req.headers.get("authorization") ?? "").replace(/^Bearer /, ""));
  const want = Buffer.from(secret);
  return given.length === want.length && timingSafeEqual(given, want);
}
