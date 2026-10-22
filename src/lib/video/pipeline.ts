import "server-only";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { nanoid } from "nanoid";
import { getCampaign, getImage } from "../db";
import { compose, type Format } from "./compose";
import { music, sfx, voiceover } from "./audio";
import { writeVideoScript } from "./script";
import { createJob, saveVideo, updateJob, type VideoJob } from "./store";

// Built at runtime so the bundler does not rewrite it into an asset reference.
const GSAP = [process.cwd(), "node_modules", "gsap", "dist", "gsap.min.js"].join(path.sep);

// Renders are CPU-heavy (headless Chrome + ffmpeg): run one at a time.
const g = globalThis as unknown as { __videoQueue?: Promise<void> };

export async function startVideo(campaignId: string, format: Format): Promise<VideoJob> {
  const job = await createJob(nanoid(12), campaignId, format);
  const prev = g.__videoQueue ?? Promise.resolve();
  g.__videoQueue = prev.then(() => run(job.id, campaignId, format)).catch(() => {});
  return job;
}

async function settle<T>(p: Promise<T>, label: string): Promise<T | null> {
  try {
    return await p;
  } catch (e) {
    console.error(`[video] ${label} failed`, e);
    return null;
  }
}

async function run(jobId: string, campaignId: string, format: Format) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "adcity-video-"));
  const t0 = Date.now();
  try {
    const campaign = await getCampaign(campaignId);
    if (!campaign) throw new Error("Campaign not found");

    await updateJob(jobId, { status: "script", progress: 5, message: "Writing the script" });
    const script = await writeVideoScript(campaign);
    await updateJob(jobId, { script, progress: 15, status: "audio", message: "Recording the voiceover" });

    // Voice first (its length drives everything), music and SFX in parallel with it.
    const roughSeconds = script.scenes.reduce((s, x) => s + x.voiceover.split(/\s+/).length, 0) / 2.7 + 3;
    const [vo, track, whoosh, impact, image] = await Promise.all([
      voiceover(script),
      settle(music(script.musicPrompt, Math.ceil(roughSeconds + 2)), "music"),
      settle(sfx(script.transitionSfx, 1), "whoosh"),
      settle(sfx(script.endSfx, 2.5), "impact"),
      getImage(campaignId),
    ]);
    await updateJob(jobId, { status: "compose", progress: 45, message: "Composing the motion design" });

    await fs.writeFile(path.join(dir, "vo.mp3"), vo.mp3);
    if (track) await fs.writeFile(path.join(dir, "music.mp3"), track);
    if (whoosh) await fs.writeFile(path.join(dir, "whoosh.mp3"), whoosh);
    if (impact) await fs.writeFile(path.join(dir, "impact.mp3"), impact);
    if (image) await fs.writeFile(path.join(dir, "kv.jpg"), image.data);
    await fs.copyFile(GSAP, path.join(dir, "gsap.min.js"));

    const { html, duration } = compose({
      campaign,
      script,
      vo,
      format,
      assets: {
        keyVisual: image ? "kv.jpg" : null,
        vo: "vo.mp3",
        music: track ? "music.mp3" : null,
        whoosh: whoosh ? "whoosh.mp3" : null,
        impact: impact ? "impact.mp3" : null,
      },
    });
    await fs.writeFile(path.join(dir, "index.html"), html);
    await updateJob(jobId, { duration, status: "render", progress: 50, message: "Rendering frames" });

    const out = path.join(dir, "ad.mp4");
    const { createRenderJob, executeRenderJob } = await import("@hyperframes/producer");
    const render = createRenderJob({ fps: 30, quality: "standard", format: "mp4", entryFile: "index.html" });
    let lastWrite = 0;
    await executeRenderJob(render, dir, out, (j, msg) => {
      const now = Date.now();
      if (now - lastWrite < 1200) return;
      lastWrite = now;
      void updateJob(jobId, {
        progress: Math.round(50 + (j.progress ?? 0) * 0.48),
        message: j.status === "encoding" ? "Encoding" : msg || "Rendering frames",
      });
    });
    await saveVideo(jobId, await fs.readFile(out));
    await updateJob(jobId, { status: "done", progress: 100, message: `Rendered in ${Math.round((Date.now() - t0) / 1000)}s` });
  } catch (e) {
    console.error("[video] job failed", jobId, e);
    await updateJob(jobId, { status: "failed", error: e instanceof Error ? e.message : String(e), message: "Failed" });
  } finally {
    if (!process.env.KEEP_VIDEO_DIRS) await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    else console.log("[video] kept", dir);
  }
}
