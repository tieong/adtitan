"use client";

import { useRef } from "react";
import Link from "next/link";
import type { Campaign } from "@/lib/types";

/** A vertical video ad thumbnail that plays muted while hovered. */
export function VideoTile({ campaign, videoId, href }: { campaign: Campaign; videoId: string; href: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  return (
    <Link
      href={href}
      draggable={false}
      className="group block w-56 sm:w-60"
      onMouseEnter={() => ref.current?.play().catch(() => {})}
      onMouseLeave={() => {
        const v = ref.current;
        if (!v) return;
        v.pause();
        v.currentTime = 2.5;
      }}
    >
      <video
        ref={ref}
        // The first frames are the intro animation; #t=2.5 shows a frame with the headline as the poster.
        src={`/api/videos/${videoId}/file#t=2.5`}
        muted
        loop
        playsInline
        preload="metadata"
        className="aspect-[9/16] w-full rounded-panel bg-surface-2 object-cover"
      />
      <div className="mt-2 truncate text-sm font-medium">{campaign.name}</div>
      <div className="truncate text-sm text-fg-2">{campaign.variants[0]?.headline}</div>
    </Link>
  );
}
