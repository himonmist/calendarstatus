import { SignJWT, jwtVerify } from "jose";

const key = (s: string) => { if (s.length < 32) throw new Error("secret too short"); return new TextEncoder().encode(s); };

/** Signed, short-lived OAuth `state` that binds the callback to the admin who started it. */
export const signState = (p: { sub: string; nonce: string }, secret: string, ttlSec = 600) =>
  new SignJWT({ nonce: p.nonce, purpose: "gcal-oauth" }).setProtectedHeader({ alg: "HS256" }).setSubject(p.sub)
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSec).sign(key(secret));

export async function verifyState(token: string, secret: string): Promise<{ sub: string; nonce: string } | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: ["HS256"] });
    if (payload.purpose !== "gcal-oauth" || typeof payload.sub !== "string" || typeof payload.nonce !== "string") return null;
    return { sub: payload.sub, nonce: payload.nonce };
  } catch { return null; }
}
