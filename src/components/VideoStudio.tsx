"use client";

import { useCallback, useEffect, useState } from "react";
import type { Campaign } from "@/lib/types";
import { Button, buttonVariants } from "@/components/lime/ui/button";
import { Segmented, SegmentedItem } from "@/components/lime/ui/segmented";
import { List, ListItem } from "@/components/lime/ui/list";
import { Status } from "@/components/lime/ui/status";
import { Progress } from "@/components/lime/ui/progress";
import { ErrorState } from "@/components/lime/ui/error-state";
import { Skeleton } from "@/components/lime/ui/skeleton";
import { Download, Icon } from "@/components/lime/icon";

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
  { key: "script", label: "Writing the script", by: "OpenAI" },
  { key: "audio", label: "Recording the voice, music and sound", by: "ElevenLabs" },
  { key: "compose", label: "Laying out the motion design", by: "HyperFrames" },
  { key: "render", label: "Rendering the video", by: "HyperFrames" },
];

const VOICE_NAMES: Record<string, string> = {
  liam: "Liam",
  charlie: "Charlie",
  brian: "Brian",
  laura: "Laura",
  jessica: "Jessica",
  daniel: "Daniel",
};

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

  // A brand new campaign gets its first video without another click.
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

  const done = jobs?.filter((j) => j.status === "done" && j.hasVideo) ?? [];
  const latest = done.find((j) => j.format === format) ?? done[0];
  const lastFailed = jobs?.[0]?.status === "failed" ? jobs[0] : null;

  return (
    <section className="flex flex-col gap-4" aria-labelledby="video-heading">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="video-heading" className="me-auto text-lg font-semibold">
          Video ad
        </h2>
        <Segmented size="sm" value={format} onValueChange={(v) => setFormat(v as Format)} aria-label="Video format">
          <SegmentedItem value="vertical">Vertical</SegmentedItem>
          <SegmentedItem value="landscape">Landscape</SegmentedItem>
        </Segmented>
        <Button
          variant={latest ? "secondary" : "primary"}
          size="sm"
          pending={starting || !!active}
          onClick={() => start(format)}
        >
          {latest ? "Make another take" : "Make the video"}
        </Button>
      </div>

      {jobs === null && <Skeleton shape="block" className="h-64 w-full rounded-panel" />}

      {active && <Rendering job={active} />}

      {!active && lastFailed && (
        <ErrorState
          title="The last render failed"
          description={lastFailed.error ?? undefined}
          onRetry={() => start(lastFailed.format)}
          retrying={starting}
        />
      )}

      {!active && latest && (
        <div className={`grid gap-6 ${latest.format === "vertical" ? "md:grid-cols-[minmax(0,300px)_1fr]" : ""}`}>
          <video
            key={latest.id}
            // #t=2.5 shows the first headline as the still frame instead of the intro.
            src={`/api/videos/${latest.id}/file#t=2.5`}
            controls
            playsInline
            preload="auto"
            className={`w-full rounded-panel bg-surface-2 ${latest.format === "vertical" ? "aspect-[9/16]" : "aspect-video"}`}
          />
          <div className="flex min-w-0 flex-col gap-4">
            {latest.script && (
              <List>
                {latest.script.scenes.map((s, i) => (
                  <ListItem key={i} title={s.title} description={`“${s.voiceover.replace(/\[[^\]]*\]\s*/g, "")}”`} />
                ))}
              </List>
            )}
            <p className="text-sm text-fg-2">
              {latest.duration?.toFixed(1)} seconds, read by {VOICE_NAMES[latest.script?.voice ?? ""] ?? "an ElevenLabs voice"}.{" "}
              {latest.message}.
            </p>
            <a href={`/api/videos/${latest.id}/file?download`} className={buttonVariants({ className: "self-start" })}>
              <Icon icon={Download} size={16} />
              Download the MP4
            </a>
          </div>
        </div>
      )}

      {jobs !== null && !active && !latest && !lastFailed && (
        <p className="text-sm text-fg-2">No video yet. Making one takes about a minute and uses the ads above as its brief.</p>
      )}
    </section>
  );
}

function Rendering({ job }: { job: Job }) {
  // -1 while the job waits for a free slot: every step still shows as next.
  const idx = STEPS.findIndex((s) => s.key === job.status);
  return (
    <div className="flex flex-col gap-4 rounded-panel bg-surface p-5">
      <Progress value={job.progress} label="Video progress" valueText={`${Math.round(job.progress)}%, ${job.message}`} />
      {(job.status === "queued" || job.message.startsWith("Waiting")) && <p className="text-sm text-fg">{job.message}</p>}
      <List>
        {STEPS.map((s, i) => (
          <ListItem
            key={s.key}
            title={s.label}
            description={s.by}
            trailing={
              i < idx ? (
                <Status status="done" label="Done" />
              ) : i === idx ? (
                <Status status="running" label={i === 3 ? `${Math.round(job.progress)}%` : "Working"} />
              ) : (
                <Status status="queued" label="Next" />
              )
            }
          />
        ))}
      </List>
    </div>
  );
}
