"use client";

import { useCallback, useEffect, useState } from "react";
import type { Campaign } from "@/lib/types";

type Format = "vertical" | "landscape";
type Job = {
  id: string;
  format: Format;
  status: "queued" | "script" | "audio" | "compose" | "render" | "done" | "failed";
  progress: number;
  message: string;
  error: string | null;
  duration: number | null;
  hasVideo: boolean;
  script: { voice: string; scenes: { kind: string; title: string; voiceover: string }[] } | null;
};

const STEPS: { key: Job["status"]; label: string; by: string }[] = [
  { key: "script", label: "Script", by: "OpenAI" },
  { key: "audio", label: "Voice, music & SFX", by: "ElevenLabs" },
  { key: "compose", label: "Motion design", by: "HyperFrames" },
  { key: "render", label: "Render MP4", by: "HyperFrames" },
];

export function VideoStudio({ campaign, autoStart = false }: { campaign: Campaign; autoStart?: boolean }) {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [format, setFormat] = useState<Format>("vertical");
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/campaigns/${campaign.id}/video`);
    if (r.ok) setJobs(await r.json());
  }, [campaign.id]);

  const start = useCallback(
    async (f: Format) => {
      setStarting(true);
      try {
        const r = await fetch(`/api/campaigns/${campaign.id}/video`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ format: f }),
        });
        const job = (await r.json()) as Job;
        setJobs((js) => [job, ...(js ?? [])]);
      } finally {
        setStarting(false);
      }
    },
    [campaign.id],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Kick off the first video automatically right after an ad is generated.
  const [autoDone, setAutoDone] = useState(false);
  useEffect(() => {
    if (!autoStart || autoDone || jobs === null) return;
    setAutoDone(true);
    if (!jobs.some((j) => j.status !== "failed")) start("vertical");
  }, [autoStart, autoDone, jobs, start]);

  const active = jobs?.find((j) => j.status !== "done" && j.status !== "failed");
  useEffect(() => {
    if (!active) return;
    const id = setInterval(load, 1500);
    return () => clearInterval(id);
  }, [active, load]);

  const latest = jobs?.find((j) => j.format === format && j.status === "done" && j.hasVideo) ?? jobs?.find((j) => j.status === "done" && j.hasVideo);
  const lastFailed = jobs?.[0]?.status === "failed" ? jobs[0] : null;
  const shown = active ?? latest;

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-wider text-white/40">Video ad</div>
          <div className="text-sm text-white/70">Voiceover, music and motion design, rendered to MP4.</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-xl border border-white/10 p-1">
            {(["vertical", "landscape"] as Format[]).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`rounded-lg px-3 py-1.5 font-mono text-xs ${format === f ? "bg-white text-black" : "text-white/55 hover:text-white"}`}
              >
                {f === "vertical" ? "9:16" : "16:9"}
              </button>
            ))}
          </div>
          <button
            onClick={() => start(format)}
            disabled={!!active || starting}
            className="rounded-xl bg-[#7cf7ff] px-4 py-2 text-sm font-semibold text-black hover:bg-white disabled:opacity-40"
          >
            {active ? "Rendering…" : latest ? "New take" : "Generate video"}
          </button>
        </div>
      </div>

      {active && <Progress job={active} />}

      {!active && lastFailed && (
        <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          Last render failed: {lastFailed.error}
        </p>
      )}

      {!active && latest && (
        <div className={`grid gap-5 ${latest.format === "vertical" ? "md:grid-cols-[minmax(0,320px)_1fr]" : ""}`}>
          <video
            key={latest.id}
            src={`/api/videos/${latest.id}/file`}
            controls
            autoPlay
            playsInline
            className={`w-full rounded-2xl bg-black ring-1 ring-white/10 ${latest.format === "vertical" ? "aspect-[9/16]" : "aspect-video"}`}
          />
          <div className="min-w-0">
            {latest.script && (
              <ol className="space-y-2.5">
                {latest.script.scenes.map((s, i) => (
                  <li key={i} className="rounded-xl border border-white/5 bg-black/20 px-3.5 py-2.5">
                    <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-white/35">
                      <span>{String(i + 1).padStart(2, "0")}</span>
                      <span>{s.kind}</span>
                    </div>
                    <div className="mt-0.5 text-sm font-semibold">{s.title}</div>
                    <div className="text-sm text-white/55">“{s.voiceover.replace(/\[[^\]]*\]\s*/g, "")}”</div>
                  </li>
                ))}
              </ol>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3 font-mono text-[11px] text-white/40">
              <span>{latest.duration?.toFixed(1)}s</span>
              <span>voice: {latest.script?.voice}</span>
              <span>{latest.message}</span>
              <a href={`/api/videos/${latest.id}/file?download`} className="ml-auto rounded-lg border border-white/15 px-3 py-1.5 text-white/80 hover:bg-white/5">
                Download MP4
              </a>
            </div>
          </div>
        </div>
      )}

      {!shown && !lastFailed && jobs !== null && (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/40">
          No video yet. One click turns this campaign into a 20-second ad.
        </div>
      )}
    </div>
  );
}

function Progress({ job }: { job: Job }) {
  const idx = STEPS.findIndex((s) => s.key === job.status);
  return (
    <div className="mb-2">
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-[#7cf7ff] transition-[width] duration-700" style={{ width: `${Math.max(3, job.progress)}%` }} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STEPS.map((s, i) => (
          <div
            key={s.key}
            className={`rounded-xl border px-3 py-2.5 ${i < idx ? "border-[#8cff7a]/30 bg-[#8cff7a]/5" : i === idx ? "border-[#7cf7ff]/40 bg-[#7cf7ff]/5" : "border-white/5"}`}
          >
            <div className="flex items-center gap-2 text-sm">
              {i < idx ? (
                <span className="text-[#8cff7a]">✓</span>
              ) : i === idx ? (
                <span className="size-1.5 animate-pulse rounded-full bg-[#7cf7ff]" />
              ) : (
                <span className="size-1.5 rounded-full bg-white/20" />
              )}
              <span className={i <= idx ? "text-white" : "text-white/35"}>{s.label}</span>
            </div>
            <div className="mt-0.5 font-mono text-[10px] text-white/35">{s.by}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 font-mono text-[11px] text-white/45">
        {job.message} · {Math.round(job.progress)}%
      </div>
    </div>
  );
}
