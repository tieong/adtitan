import "server-only";
import { createClient, type ClickHouseClient } from "@clickhouse/client";
import type { CampaignStats, TrackEvent, VariantStats } from "./types";

// Ad events (impressions, clicks, visits) go to Aiven ClickHouse. Without
// CLICKHOUSE_URL they are kept in memory, which is enough for a local demo.

type Stored = TrackEvent & { ts: number };

const g = globalThis as unknown as {
  __ch?: ClickHouseClient;
  __chReady?: Promise<void>;
  __events?: Stored[];
};

function client(): ClickHouseClient | null {
  const url = process.env.CLICKHOUSE_URL;
  if (!url) return null;
  if (!g.__ch) {
    g.__ch = createClient({
      url,
      username: process.env.CLICKHOUSE_USER ?? "avnadmin",
      password: process.env.CLICKHOUSE_PASSWORD ?? "",
      database: "default",
      request_timeout: 15_000,
    });
  }
  if (!g.__chReady) {
    g.__chReady = g.__ch
      .command({
        query: `create table if not exists ad_events (
          ts DateTime64(3) default now64(3),
          type LowCardinality(String),
          campaign_id String,
          variant UInt8,
          session_id String,
          source LowCardinality(String)
        ) engine = MergeTree order by (campaign_id, ts)`,
      })
      .then(() => undefined)
      .catch((e) => {
        g.__chReady = undefined;
        throw e;
      });
  }
  return g.__ch;
}

async function ready() {
  const c = client();
  if (c) await g.__chReady;
  return c;
}

function mem() {
  g.__events ??= [];
  return g.__events;
}

export async function trackEvents(events: TrackEvent[]) {
  if (events.length === 0) return;
  const c = await ready();
  if (!c) {
    const now = Date.now();
    mem().push(...events.map((e) => ({ ...e, ts: now })));
    return;
  }
  await c.insert({
    table: "ad_events",
    values: events.map((e) => ({
      type: e.type,
      campaign_id: e.campaignId,
      variant: e.variant,
      session_id: e.sessionId,
      source: e.source,
    })),
    format: "JSONEachRow",
  });
}

function ctr(clicks: number, impressions: number) {
  return impressions > 0 ? clicks / impressions : 0;
}

type Totals = { impressions: number; clicks: number; visits: number; uniqueViewers: number };

export async function allTotals(): Promise<Map<string, Totals>> {
  const c = await ready();
  const out = new Map<string, Totals>();
  if (!c) {
    const viewers = new Map<string, Set<string>>();
    for (const e of mem()) {
      const t = out.get(e.campaignId) ?? { impressions: 0, clicks: 0, visits: 0, uniqueViewers: 0 };
      t[`${e.type}s` as "impressions" | "clicks" | "visits"]++;
      out.set(e.campaignId, t);
      if (e.type === "impression") {
        const s = viewers.get(e.campaignId) ?? new Set();
        s.add(e.sessionId);
        viewers.set(e.campaignId, s);
      }
    }
    for (const [id, s] of viewers) out.get(id)!.uniqueViewers = s.size;
    return out;
  }
  const rs = await c.query({
    query: `select campaign_id,
        countIf(type = 'impression') as impressions,
        countIf(type = 'click') as clicks,
        countIf(type = 'visit') as visits,
        uniqExactIf(session_id, type = 'impression') as viewers
      from ad_events group by campaign_id`,
    format: "JSONEachRow",
  });
  const rows = await rs.json<{ campaign_id: string; impressions: string; clicks: string; visits: string; viewers: string }>();
  for (const r of rows) {
    out.set(r.campaign_id, {
      impressions: Number(r.impressions),
      clicks: Number(r.clicks),
      visits: Number(r.visits),
      uniqueViewers: Number(r.viewers),
    });
  }
  return out;
}

export async function campaignStats(campaignId: string, variantCount: number): Promise<CampaignStats> {
  const c = await ready();
  const variants: VariantStats[] = Array.from({ length: variantCount }, (_, i) => ({
    variant: i,
    impressions: 0,
    clicks: 0,
    visits: 0,
  }));
  // 30 one-minute buckets ending now.
  const bucketMs = 60_000;
  const end = Math.floor(Date.now() / bucketMs) * bucketMs;
  const start = end - 29 * bucketMs;
  const series = Array.from({ length: 30 }, (_, i) => ({
    t: new Date(start + i * bucketMs).toISOString(),
    impressions: 0,
    clicks: 0,
  }));
  let uniqueViewers = 0;

  if (!c) {
    const viewers = new Set<string>();
    for (const e of mem()) {
      if (e.campaignId !== campaignId) continue;
      const v = variants[e.variant];
      if (v) v[`${e.type}s` as "impressions" | "clicks" | "visits"]++;
      if (e.type === "impression") viewers.add(e.sessionId);
      const idx = Math.floor((e.ts - start) / bucketMs);
      if (idx >= 0 && idx < 30 && e.type !== "visit") series[idx][`${e.type}s` as "impressions" | "clicks"]++;
    }
    uniqueViewers = viewers.size;
  } else {
    const [byVariant, bySeries, viewers] = await Promise.all([
      c.query({
        query: `select variant, countIf(type='impression') as i, countIf(type='click') as c, countIf(type='visit') as v
          from ad_events where campaign_id = {id:String} group by variant`,
        query_params: { id: campaignId },
        format: "JSONEachRow",
      }).then((r) => r.json<{ variant: number; i: string; c: string; v: string }>()),
      c.query({
        query: `select toUnixTimestamp(toStartOfMinute(ts)) * 1000 as b, countIf(type='impression') as i, countIf(type='click') as c
          from ad_events where campaign_id = {id:String} and ts >= now() - interval 30 minute group by b`,
        query_params: { id: campaignId },
        format: "JSONEachRow",
      }).then((r) => r.json<{ b: string; i: string; c: string }>()),
      c.query({
        query: `select uniqExact(session_id) as n from ad_events where campaign_id = {id:String} and type = 'impression'`,
        query_params: { id: campaignId },
        format: "JSONEachRow",
      }).then((r) => r.json<{ n: string }>()),
    ]);
    for (const r of byVariant) {
      const v = variants[Number(r.variant)];
      if (!v) continue;
      v.impressions = Number(r.i);
      v.clicks = Number(r.c);
      v.visits = Number(r.v);
    }
    for (const r of bySeries) {
      const idx = Math.floor((Number(r.b) - start) / bucketMs);
      if (idx >= 0 && idx < 30) {
        series[idx].impressions = Number(r.i);
        series[idx].clicks = Number(r.c);
      }
    }
    uniqueViewers = Number(viewers[0]?.n ?? 0);
  }

  const impressions = variants.reduce((s, v) => s + v.impressions, 0);
  const clicks = variants.reduce((s, v) => s + v.clicks, 0);
  const visits = variants.reduce((s, v) => s + v.visits, 0);
  return { campaignId, impressions, clicks, visits, ctr: ctr(clicks, impressions), uniqueViewers, variants, series };
}

export async function deleteEvents(campaignId: string) {
  const c = await ready();
  if (!c) {
    g.__events = mem().filter((e) => e.campaignId !== campaignId);
    return;
  }
  await c.command({ query: `alter table ad_events delete where campaign_id = {id:String}`, query_params: { id: campaignId } });
}
