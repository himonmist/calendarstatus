const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

/** Origin-based CSRF defence for cookie-authenticated, state-changing requests. */
export function isSameOrigin(method: string, headers: Headers): boolean {
  if (SAFE.has(method.toUpperCase())) return true;
  const origin = headers.get("origin");
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!origin || !host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}
