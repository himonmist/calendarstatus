/** Fixed-window in-memory limiter. Swap for a Redis-backed implementation behind the same shape in multi-instance deploys. */
export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();
  constructor(private now: () => number = Date.now) {}

  check(key: string, limit: number, windowMs: number) {
    const t = this.now();
    if (this.hits.size > 10_000) for (const [k, v] of this.hits) if (v.resetAt <= t) this.hits.delete(k);
    let e = this.hits.get(key);
    if (!e || e.resetAt <= t) { e = { count: 0, resetAt: t + windowMs }; this.hits.set(key, e); }
    e.count++;
    return { allowed: e.count <= limit, retryAfterSec: Math.max(1, Math.ceil((e.resetAt - t) / 1000)) };
  }
}

export const globalLimiter = new RateLimiter();
