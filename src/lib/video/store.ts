import "server-only";
import { onWorkers, pg, type Pg } from "../runtime";
import type { Format } from "./compose";

// Video jobs and rendered MP4s live next to campaigns in Aiven PostgreSQL.
// Without DATABASE_URL everything stays in memory.

export type VideoStatus = "queued" | "script" | "audio" | "compose" | "render" | "done" | "failed";

export type VideoJob = {
  id: string;
  campaignId: string;
  format: Format;
  status: VideoStatus;
  progress: number;
  message: string;
  error: string | null;
  script: unknown;
  duration: number | null;
  hasVideo: boolean;
  createdAt: string;
  updatedAt: string;
};

const g = globalThis as unknown as {
  __vReady?: Promise<void>;
  __vmem?: { jobs: Map<string, VideoJob>; files: Map<string, Buffer> };
};

function pool(): Pg | null {
  const p = pg();
  if (!p || onWorkers) return p;
  g.__vReady ??= p
    .query(
      `create table if not exists video_jobs (
        id text primary key,
        campaign_id text not null,
        format text not null,
        status text not null,
        progress real not null default 0,
        message text not null default '',
        error text,
        script jsonb,
        duration real,
        video bytea,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
      create index if not exists video_jobs_campaign_idx on video_jobs (campaign_id, created_at desc);`,
    )
    .then(() => undefined)
    .catch((e) => {
      g.__vReady = undefined;
      throw e;
    });
  return p;
}

async function ready() {
  const p = pool();
  if (p) await g.__vReady;
  return p;
}

function mem() {
  g.__vmem ??= { jobs: new Map(), files: new Map() };
  return g.__vmem;
}

type Row = {
  id: string;
  campaign_id: string;
  format: Format;
  status: VideoStatus;
  progress: number;
  message: string;
  error: string | null;
  script: unknown;
  duration: number | null;
  has_video: boolean;
  created_at: Date;
  updated_at: Date;
};

const COLS = `id, campaign_id, format, status, progress, message, error, script, duration,
  (video is not null) as has_video, created_at, updated_at`;

function fromRow(r: Row): VideoJob {
  return {
    id: r.id,
    campaignId: r.campaign_id,
    format: r.format,
    status: r.status,
    progress: r.progress,
    message: r.message,
    error: r.error,
    script: r.script,
    duration: r.duration,
    hasVideo: r.has_video,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function createJob(id: string, campaignId: string, format: Format): Promise<VideoJob> {
  const p = await ready();
  const now = new Date().toISOString();
  if (!p) {
    const job: VideoJob = {
      id,
      campaignId,
      format,
      status: "queued",
      progress: 0,
      message: "Queued",
      error: null,
      script: null,
      duration: null,
      hasVideo: false,
      createdAt: now,
      updatedAt: now,
    };
    mem().jobs.set(id, job);
    return job;
  }
  const { rows } = await p.query<Row>(
    `insert into video_jobs (id, campaign_id, format, status, message) values ($1,$2,$3,'queued','Queued') returning ${COLS}`,
    [id, campaignId, format],
  );
  return fromRow(rows[0]);
}

export async function updateJob(
  id: string,
  patch: Partial<Pick<VideoJob, "status" | "progress" | "message" | "error" | "script" | "duration">>,
) {
  const p = await ready();
  if (!p) {
    const j = mem().jobs.get(id);
    if (j) Object.assign(j, patch, { updatedAt: new Date().toISOString() });
    return;
  }
  const cols = {
    status: patch.status,
    progress: patch.progress,
    message: patch.message,
    error: patch.error,
    script: patch.script === undefined ? undefined : JSON.stringify(patch.script),
    duration: patch.duration,
  };
  const sets: string[] = [];
  const vals: unknown[] = [id];
  for (const [k, v] of Object.entries(cols)) {
    if (v === undefined) continue;
    vals.push(v);
    sets.push(`${k} = $${vals.length}`);
  }
  if (!sets.length) return;
  await p.query(`update video_jobs set ${sets.join(", ")}, updated_at = now() where id = $1`, vals);
}

export async function saveVideo(id: string, mp4: Buffer) {
  const p = await ready();
  if (!p) {
    mem().files.set(id, mp4);
    const j = mem().jobs.get(id);
    if (j) j.hasVideo = true;
    return;
  }
  await p.query(`update video_jobs set video = $2, updated_at = now() where id = $1`, [id, mp4]);
}

export async function getJob(id: string): Promise<VideoJob | null> {
  const p = await ready();
  if (!p) return mem().jobs.get(id) ?? null;
  const { rows } = await p.query<Row>(`select ${COLS} from video_jobs where id = $1`, [id]);
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function jobsFor(campaignId: string): Promise<VideoJob[]> {
  const p = await ready();
  if (!p) return [...mem().jobs.values()].filter((j) => j.campaignId === campaignId).reverse();
  const { rows } = await p.query<Row>(
    `select ${COLS} from video_jobs where campaign_id = $1 order by created_at desc limit 10`,
    [campaignId],
  );
  return rows.map(fromRow);
}

/** Latest finished video per campaign, for galleries. */
export async function latestVideos(): Promise<Map<string, VideoJob>> {
  const p = await ready();
  const out = new Map<string, VideoJob>();
  if (!p) {
    for (const j of mem().jobs.values()) if (j.status === "done" && j.hasVideo) out.set(j.campaignId, j);
    return out;
  }
  // Prefer the newest vertical take, which is what the feed shows.
  const { rows } = await p.query<Row>(
    `select distinct on (campaign_id) ${COLS} from video_jobs
     where status = 'done' and video is not null
     order by campaign_id, (format = 'vertical') desc, created_at desc`,
  );
  for (const r of rows) out.set(r.campaign_id, fromRow(r));
  return out;
}

export async function getVideo(id: string): Promise<Buffer | null> {
  const p = await ready();
  if (!p) return mem().files.get(id) ?? null;
  const { rows } = await p.query<{ video: Buffer | null }>(`select video from video_jobs where id = $1`, [id]);
  return rows[0]?.video ?? null;
}

