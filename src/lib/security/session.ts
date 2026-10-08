import { SignJWT, jwtVerify } from "jose";

export interface SessionPayload { sub: string; role: "admin" }

function key(secret: string) {
  if (secret.length < 32) throw new Error("NEXTAUTH_SECRET must be at least 32 characters");
  return new TextEncoder().encode(secret);
}

export async function signSession(p: SessionPayload, secret: string, ttlSec: number): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ role: p.role }).setProtectedHeader({ alg: "HS256" })
    .setSubject(p.sub).setIssuedAt(now).setExpirationTime(now + ttlSec).sign(key(secret));
}

export async function verifySession(token: string, secret: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: ["HS256"] });
    if (payload.role !== "admin" || typeof payload.sub !== "string") return null;
    return { sub: payload.sub, role: "admin" };
  } catch { return null; }
}

export const SESSION_COOKIE = "__Host-admin_session";
