"use client";

import { DraggableMarquee } from "@/components/obsidian/draggable-marquee";
import type { Campaign } from "@/lib/types";
import { VideoTile } from "./VideoTile";

/** The hackathon's video ads in a row you drag or throw. It never scrolls on its own. */
export function Reel({ ads }: { ads: { campaign: Campaign; videoId: string }[] }) {
  return (
    <DraggableMarquee
      items={ads.map((a) => ({ ...a, id: a.videoId, src: "" }))}
      speed={0}
      repeatCount={ads.length < 6 ? 3 : 2}
      gapClassName="gap-4"
      itemClassName=""
      label="Video ads from the hackathon. Drag, or use the left and right arrow keys."
      renderItem={(item) => {
        const ad = item as unknown as { campaign: Campaign; videoId: string };
        return <VideoTile campaign={ad.campaign} videoId={ad.videoId} href={`/watch?start=${ad.videoId}`} />;
      }}
    />
  );
}
