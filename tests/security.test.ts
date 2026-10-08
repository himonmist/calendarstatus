import { describe, it, expect, beforeEach } from "vitest";
import { encryptSecret, decryptSecret } from "@/lib/security/crypto";
import { signSession, verifySession } from "@/lib/security/session";
import { hashPassword, verifyPassword } from "@/lib/security/password";
import { RateLimiter } from "@/lib/security/rate-limit";
import { isSameOrigin } from "@/lib/security/csrf";
import { escapeHtml } from "@/lib/security/html";
import { bookingInputSchema } from "@/lib/validation";

const KEY = "a".repeat(64);
const SECRET = "s".repeat(40);

describe("token encryption (AES-256-GCM)", () => {
  it("round-trips and uses a fresh IV each time", () => {
    const a = encryptSecret("refresh-token-123", KEY), b = encryptSecret("refresh-token-123", KEY);
    expect(a).not.toBe(b);
    expect(a).not.toContain("refresh-token");
    expect(decryptSecret(a, KEY)).toBe("refresh-token-123");
  });
  it("rejects tampering and wrong keys", () => {
    const c = encryptSecret("x", KEY);
    const tampered = c.slice(0, -2) + (c.endsWith("AA") ? "BB" : "AA");
    expect(() => decryptSecret(tampered, KEY)).toThrow();
    expect(() => decryptSecret(c, "b".repeat(64))).toThrow();
  });
  it("rejects malformed keys", () => {
    expect(() => encryptSecret("x", "short")).toThrow();
  });
});

describe("admin sessions", () => {
  it("verifies a valid session", async () => {
    const t = await signSession({ sub: "admin@x.com", role: "admin" }, SECRET, 60);
    expect((await verifySession(t, SECRET))?.sub).toBe("admin@x.com");
  });
  it("rejects wrong secret, garbage, expired, and alg=none", async () => {
    const t = await signSession({ sub: "a", role: "admin" }, SECRET, 60);
    expect(await verifySession(t, "z".repeat(40))).toBeNull();
    expect(await verifySession("garbage", SECRET)).toBeNull();
    const expired = await signSession({ sub: "a", role: "admin" }, SECRET, -10);
    expect(await verifySession(expired, SECRET)).toBeNull();
    const none = Buffer.from('{"alg":"none"}').toString("base64url") + "." +
      Buffer.from('{"sub":"a","role":"admin"}').toString("base64url") + ".";
    expect(await verifySession(none, SECRET)).toBeNull();
  });
  it("refuses weak secrets", async () => {
    await expect(signSession({ sub: "a", role: "admin" }, "short", 60)).rejects.toThrow();
  });
});

describe("password hashing (scrypt)", () => {
  it("verifies correct and rejects wrong / malformed", async () => {
    const h = await hashPassword("Correct Horse 9!");
    expect(await verifyPassword("Correct Horse 9!", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
    expect(await verifyPassword("x", "not-a-hash")).toBe(false);
    expect(h).not.toContain("Correct");
  });
});

describe("rate limiter", () => {
  let now = 1_000_000;
  let rl: RateLimiter;
  beforeEach(() => { now = 1_000_000; rl = new RateLimiter(() => now); });
  it("allows up to the limit then blocks, per key", () => {
    for (let i = 0; i < 3; i++) expect(rl.check("ip1", 3, 60_000).allowed).toBe(true);
    const r = rl.check("ip1", 3, 60_000);
    expect(r.allowed).toBe(false);
    expect(r.retryAfterSec).toBeGreaterThan(0);
    expect(rl.check("ip2", 3, 60_000).allowed).toBe(true);
  });
  it("resets after the window", () => {
    for (let i = 0; i < 3; i++) rl.check("k", 3, 60_000);
    now += 60_001;
    expect(rl.check("k", 3, 60_000).allowed).toBe(true);
  });
});

describe("CSRF origin check", () => {
  const h = (o: Record<string, string>) => new Headers(o);
  it("allows same-origin and safe methods", () => {
    expect(isSameOrigin("POST", h({ origin: "https://a.com", host: "a.com" }))).toBe(true);
    expect(isSameOrigin("GET", h({ origin: "https://evil.com", host: "a.com" }))).toBe(true);
  });
  it("blocks cross-origin and missing origin on unsafe methods", () => {
    expect(isSameOrigin("POST", h({ origin: "https://evil.com", host: "a.com" }))).toBe(false);
    expect(isSameOrigin("DELETE", h({ host: "a.com" }))).toBe(false);
    expect(isSameOrigin("POST", h({ origin: "https://a.com.evil.com", host: "a.com" }))).toBe(false);
  });
});

describe("html escaping", () => {
  it("escapes dangerous characters", () => {
    expect(escapeHtml(`<script>alert("x")</script>&'`)).toBe("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&#39;");
  });
});

describe("booking input validation", () => {
  const ok = {
    fullName: "Md Rahman", organization: "ABC Pharma", email: "Rahman@Example.com", phone: "+8801712345678",
    participants: 25, format: "online", country: "Bangladesh", city: "Dhaka", notes: "Need sales AI",
    programId: "prog_1", slotStart: "2026-10-20T04:00:00.000Z", holdToken: "t".repeat(20), leadSource: "linkedin",
  };
  it("accepts valid input and normalizes email", () => {
    const r = bookingInputSchema.parse(ok);
    expect(r.email).toBe("rahman@example.com");
  });
  it("rejects bad email, participants, format, oversized notes, unknown keys stripped", () => {
    expect(bookingInputSchema.safeParse({ ...ok, email: "nope" }).success).toBe(false);
    expect(bookingInputSchema.safeParse({ ...ok, participants: 0 }).success).toBe(false);
    expect(bookingInputSchema.safeParse({ ...ok, participants: 100000 }).success).toBe(false);
    expect(bookingInputSchema.safeParse({ ...ok, format: "teleport" }).success).toBe(false);
    expect(bookingInputSchema.safeParse({ ...ok, notes: "x".repeat(5001) }).success).toBe(false);
    expect((bookingInputSchema.parse({ ...ok, isAdmin: true }) as any).isAdmin).toBeUndefined();
  });
  it("strips control characters from text fields", () => {
    expect(bookingInputSchema.parse({ ...ok, fullName: "Md\u0000 Rah\u0007man" }).fullName).toBe("Md Rahman");
  });
});
