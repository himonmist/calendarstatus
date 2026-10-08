export interface Queryable { query(sql: string, params?: unknown[]): Promise<{ rows: any[] }> }
export interface Db extends Queryable {
  /** Runs fn inside a single transaction on one connection. */
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
}

/** Adapter for node-postgres Pool. */
export function pgDb(pool: import("pg").Pool): Db {
  return {
    query: (s, p) => pool.query(s, p as any[]),
    async tx(fn) {
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        const r = await fn({ query: (s, p) => c.query(s, p as any[]) });
        await c.query("COMMIT"); return r;
      } catch (e) { await c.query("ROLLBACK").catch(() => {}); throw e; } finally { c.release(); }
    },
  };
}
