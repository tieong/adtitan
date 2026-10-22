"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { VideoAd } from "@/lib/feed";
import { Button, buttonVariants } from "@/components/lime/ui/button";
import { Empty, EmptyActions, EmptyDescription, EmptyTitle } from "@/components/lime/ui/empty";
import { Icon, Launch, VolumeMute, VolumeUp } from "@/components/lime/icon";
import { visitUrl } from "@/lib/client";
import { track } from "@/lib/track";

const DWELL_MS = 2000;

export function Feed({ ads, start }: { ads: VideoAd[]; start: string | null }) {
  const [muted, setMuted] = useState(true);
  const [active, setActive] = useState(0);
  const items = useRef<(HTMLElement | null)[]>([]);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);

  // Jump to the ad picked on the home page.
  useEffect(() => {
    const i = ads.findIndex((a) => a.videoId === start);
    if (i > 0) items.current[i]?.scrollIntoView({ block: "start" });
  }, [ads, start]);

  // The ad mostly on screen plays; the others pause.
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio > 0.6) setActive(Number((e.target as HTMLElement).dataset.index));
        }
      },
      { threshold: [0.6] },
    );
    items.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [ads.length]);

  useEffect(() => {
    videos.current.forEach((v, i) => {
      if (!v) return;
      if (i === active) v.play().catch(() => {});
      else v.pause();
    });
    const ad = ads[active];
    if (!ad) return;
    // An impression is two seconds of the ad playing on screen.
    const t = setTimeout(() => track("impression", ad.campaign.id, 0, "feed"), DWELL_MS);
    return () => clearTimeout(t);
  }, [active, ads]);

  useEffect(() => {
    videos.current.forEach((v) => v && (v.muted = muted));
  }, [muted]);

  if (ads.length === 0) {
    return (
      <main className="mx-auto w-full max-w-md px-4 pt-16">
        <Empty>
          <EmptyTitle>No video ads yet</EmptyTitle>
          <EmptyDescription>Make the first one: paste your project link and it shows up here in about a minute.</EmptyDescription>
          <EmptyActions>
            <Link href="/" className={buttonVariants()}>
              Make an ad
            </Link>
          </EmptyActions>
        </Empty>
      </main>
    );
  }

  return (
    <main className="h-[calc(100dvh-56px)] snap-y snap-mandatory overflow-y-auto">
      {ads.map((ad, i) => {
        const c = ad.campaign;
        return (
          <section
            key={ad.videoId}
            ref={(el) => {
              items.current[i] = el;
            }}
            data-index={i}
            aria-label={c.name}
            className="relative mx-auto flex h-[calc(100dvh-56px)] w-full max-w-5xl snap-start items-center justify-center gap-8 px-4 py-4 sm:px-6"
          >
            <div className="relative h-full max-h-[880px]">
              <video
                ref={(el) => {
                  videos.current[i] = el;
                }}
                src={`/api/videos/${ad.videoId}/file`}
                muted={muted}
                loop
                playsInline
                preload={Math.abs(i - active) <= 1 ? "auto" : "metadata"}
                onClick={() => setMuted((m) => !m)}
                className={`h-full rounded-panel bg-surface object-cover ${ad.format === "vertical" ? "aspect-[9/16]" : "aspect-video max-w-[min(90vw,880px)] object-contain"}`}
              />
              <Button
                variant="secondary"
                size="icon"
                aria-label={muted ? "Turn sound on" : "Turn sound off"}
                onClick={() => setMuted((m) => !m)}
                className="absolute end-3 top-3"
              >
                <Icon icon={muted ? VolumeMute : VolumeUp} size={20} />
              </Button>
            </div>
            <div className="hidden w-72 shrink-0 flex-col gap-4 md:flex">
              <div className="flex flex-col gap-1">
                <h2 className="text-xl leading-tight font-semibold tracking-tight">{c.name}</h2>
                <p className="text-sm text-fg-2">{c.description}</p>
              </div>
              <a
                href={visitUrl(c, 0, "feed")}
                target="_blank"
                rel="noopener"
                onClick={() => track("click", c.id, 0, "feed")}
                className={buttonVariants({ size: "lg" })}
              >
                <Icon icon={Launch} size={16} />
                Open {c.name}
              </a>
              <Link href={`/c/${c.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                See how this ad performs
              </Link>
            </div>
            <div className="absolute inset-x-4 bottom-6 flex md:hidden">
              <a
                href={visitUrl(c, 0, "feed")}
                target="_blank"
                rel="noopener"
                onClick={() => track("click", c.id, 0, "feed")}
                className={buttonVariants({ size: "lg", className: "w-full" })}
              >
                Open {c.name}
              </a>
            </div>
          </section>
        );
      })}
    </main>
  );
}
