import "server-only";
import { Pool } from "pg";
import type { Campaign } from "./types";

// Campaigns live in Aiven PostgreSQL. Without DATABASE_URL we fall back to an
// in-process store so the demo still runs on a laptop with no network.

const g = globalThis as unknown as {
  __pg?: Pool;
  __pgReady?: Promise<void>;
  __mem?: { campaigns: Map<string, Campaign>; images: Map<string, { data: Buffer; mime: string }> };
};

function sslConfig() {
  const ca = process.env.AIVEN_CA_CERT?.replace(/\\n/g, "\n");
  return ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false };
}

function pool(): Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!g.__pg) {
    // pg's URL parser would override our ssl object with sslmode=require, so strip it.
    const u = new URL(url);
    u.searchParams.delete("sslmode");
    g.__pg = new Pool({ connectionString: u.toString(), ssl: sslConfig(), max: 5 });
  }
  if (!g.__pgReady) {
    g.__pgReady = g.__pg
      .query(
        `create table if not exists campaigns (
          id text primary key,
          url text not null,
          kind text not null,
          name text not null,
          description text not null,
          category text not null,
          emoji text not null,
          palette jsonb not null,
          variants jsonb not null,
          image_prompt text not null default '',
          meta jsonb not null default '{}',
          slot serial,
          image bytea,
          image_mime text,
          created_at timestamptz not null default now()
        );
        create unique index if not exists campaigns_url_idx on campaigns (url);`,
      )
      .then(() => undefined)
      .catch((e) => {
        g.__pgReady = undefined;
        throw e;
      });
  }
  return g.__pg;
}

async function ready() {
  const p = pool();
  if (p) await g.__pgReady;
  return p;
}

function mem() {
  g.__mem ??= { campaigns: new Map(), images: new Map() };
  return g.__mem;
}

type Row = {
  id: string;
  url: string;
  kind: Campaign["kind"];
  name: string;
  description: string;
  category: string;
  emoji: string;
  palette: Campaign["palette"];
  variants: Campaign["variants"];
  image_prompt: string;
  meta: Record<string, unknown>;
  slot: number;
  has_image: boolean;
  created_at: Date;
};

const COLS = `id, url, kind, name, description, category, emoji, palette, variants, image_prompt, meta, slot,
  (image is not null) as has_image, created_at`;

function fromRow(r: Row): Campaign {
  return {
    id: r.id,
    url: r.url,
    kind: r.kind,
    name: r.name,
    description: r.description,
    category: r.category,
    emoji: r.emoji,
    palette: r.palette,
    variants: r.variants,
    imagePrompt: r.image_prompt,
    meta: r.meta,
    slot: r.slot,
    hasImage: r.has_image,
    createdAt: r.created_at.toISOString(),
  };
}

export async function listCampaigns(): Promise<Campaign[]> {
  const p = await ready();
  if (!p) return [...mem().campaigns.values()].sort((a, b) => a.slot - b.slot);
  const { rows } = await p.query<Row>(`select ${COLS} from campaigns order by slot asc`);
  return rows.map(fromRow);
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  const p = await ready();
  if (!p) return mem().campaigns.get(id) ?? null;
  const { rows } = await p.query<Row>(`select ${COLS} from campaigns where id = $1`, [id]);
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function getCampaignByUrl(url: string): Promise<Campaign | null> {
  const p = await ready();
  if (!p) return [...mem().campaigns.values()].find((c) => c.url === url) ?? null;
  const { rows } = await p.query<Row>(`select ${COLS} from campaigns where url = $1`, [url]);
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function saveCampaign(c: Omit<Campaign, "slot" | "createdAt" | "hasImage">): Promise<Campaign> {
  const p = await ready();
  if (!p) {
    const m = mem();
    const existing = [...m.campaigns.values()].find((x) => x.url === c.url);
    const saved: Campaign = {
      ...c,
      id: existing?.id ?? c.id,
      slot: existing?.slot ?? m.campaigns.size + 1,
      hasImage: m.images.has(existing?.id ?? c.id),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    m.campaigns.set(saved.id, saved);
    return saved;
  }
  const { rows } = await p.query<Row>(
    `insert into campaigns (id, url, kind, name, description, category, emoji, palette, variants, image_prompt, meta)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     on conflict (url) do update set
       name = excluded.name, description = excluded.description, category = excluded.category,
       emoji = excluded.emoji, palette = excluded.palette, variants = excluded.variants,
       image_prompt = excluded.image_prompt, meta = excluded.meta
     returning ${COLS}`,
    [
      c.id,
      c.url,
      c.kind,
      c.name,
      c.description,
      c.category,
      c.emoji,
      JSON.stringify(c.palette),
      JSON.stringify(c.variants),
      c.imagePrompt,
      JSON.stringify(c.meta),
    ],
  );
  return fromRow(rows[0]);
}

export async function saveImage(id: string, data: Buffer, mime: string) {
  const p = await ready();
  if (!p) {
    const m = mem();
    m.images.set(id, { data, mime });
    const c = m.campaigns.get(id);
    if (c) c.hasImage = true;
    return;
  }
  await p.query(`update campaigns set image = $2, image_mime = $3 where id = $1`, [id, data, mime]);
}

export async function getImage(id: string): Promise<{ data: Buffer; mime: string } | null> {
  const p = await ready();
  if (!p) return mem().images.get(id) ?? null;
  const { rows } = await p.query<{ image: Buffer | null; image_mime: string | null }>(
    `select image, image_mime from campaigns where id = $1`,
    [id],
  );
  const r = rows[0];
  return r?.image ? { data: r.image, mime: r.image_mime ?? "image/png" } : null;
}

export async function deleteCampaign(id: string) {
  const p = await ready();
  if (!p) {
    mem().campaigns.delete(id);
    mem().images.delete(id);
    return;
  }
  await p.query(`delete from campaigns where id = $1`, [id]);
}
