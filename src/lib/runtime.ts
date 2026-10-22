import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Client, Pool, type QueryResultRow } from "pg";

// On Cloudflare Workers a socket belongs to the request that opened it, so the
// long-lived pools and clients we keep on globalThis under Node would hang the
// next request. There we open a connection per call (Postgres goes through
// Hyperdrive, which does the pooling) and skip the create-table bootstrap.
export const onWorkers = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";

export type Pg = {
  query<R extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<{ rows: R[] }>;
};

const g = globalThis as unknown as { __pgPool?: Pool };

function nodePool(url: string): Pool {
  if (!g.__pgPool) {
    // pg's URL parser would override our ssl object with sslmode=require, so strip it.
    const u = new URL(url);
    u.searchParams.delete("sslmode");
    const ca = process.env.AIVEN_CA_CERT?.replace(/\\n/g, "\n");
    g.__pgPool = new Pool({
      connectionString: u.toString(),
      ssl: ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false },
      max: 5,
    });
  }
  return g.__pgPool;
}

const workersPg: Pg = {
  async query(text, values) {
    const env = getCloudflareContext().env as unknown as { HYPERDRIVE: { connectionString: string } };
    const c = new Client({ connectionString: env.HYPERDRIVE.connectionString });
    await c.connect();
    try {
      return await c.query(text, values);
    } finally {
      c.end().catch(() => {});
    }
  },
};

/** Postgres, or null when DATABASE_URL is unset and callers use their memory store. */
export function pg(): Pg | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  return onWorkers ? workersPg : nodePool(url);
}
