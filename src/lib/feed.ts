import "server-only";
import { listCampaigns } from "./db";
import { allTotals } from "./events";
import { latestVideos } from "./video/store";
import type { Campaign } from "./types";

export type VideoAd = {
  campaign: Campaign;
  videoId: string;
  format: "vertical" | "landscape";
  duration: number | null;
  views: number;
  clicks: number;
};

/** Every campaign that has a finished video, newest campaign first. */
export async function videoAds(): Promise<VideoAd[]> {
  const [campaigns, videos, totals] = await Promise.all([listCampaigns(), latestVideos(), allTotals()]);
  return campaigns
    .filter((c) => videos.has(c.id))
    .reverse()
    .map((c) => {
      const v = videos.get(c.id)!;
      const t = totals.get(c.id);
      return {
        campaign: c,
        videoId: v.id,
        format: v.format,
        duration: v.duration,
        views: t?.impressions ?? 0,
        clicks: t?.clicks ?? 0,
      };
    });
}
